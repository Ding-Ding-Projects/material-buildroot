import {browserWorkerURL} from './browser-native-worker-url.js';
import {registerBrowserConverter} from './browser-native-queue.js';
let preparedContext,ready;
const workletLoads=new WeakMap();
function prepare(){if(preparedContext&&preparedContext.state!=='closed')return;try{if(!window.isSecureContext||!globalThis.AudioContext)return;preparedContext=new AudioContext({sampleRate:48000});ready=preparedContext.resume().then(()=>true,()=>false);}catch{preparedContext=undefined;ready=Promise.resolve(false);}}
async function release(){const context=preparedContext;preparedContext=undefined;ready=undefined;if(context&&context.state!=='closed')await context.close();}
function execute(item,{signal,onProgress=()=>{},onPreview=()=>{}}){
 const video=item.category==='video',seconds=item.options.seconds;
 return new Promise((resolve,reject)=>{
  let settled=false,player,canvas,source,node,silence,recorder,stream,url,watchdog,frameTimer,frameCallback,lastProgress=0;
  const context=preparedContext;
  const cleanup=()=>{clearTimeout(watchdog);clearInterval(frameTimer);signal.removeEventListener('abort',cancel);document.removeEventListener('visibilitychange',visibility);if(player){player.pause();if(frameCallback!==undefined&&player.cancelVideoFrameCallback)player.cancelVideoFrameCallback(frameCallback);}node?.disconnect();node?.port.close();source?.disconnect();silence?.disconnect();stream?.getTracks().forEach(track=>track.stop());if(recorder){recorder.ondataavailable=null;recorder.onstop=null;recorder.onerror=null;if(recorder.state!=='inactive')try{recorder.stop();}catch{}}if(player){player.removeAttribute('src');player.load();player.remove();}canvas?.remove();if(url)URL.revokeObjectURL(url);};
  const fail=error=>{if(settled)return;settled=true;cleanup();reject(error);};
  const cancel=()=>fail(new DOMException('Cancelled','AbortError'));
  const visibility=()=>{if(document.hidden)fail(Error('MEDIA_VISIBILITY_INTERRUPTED'));};
  const finish=(blob,details)=>{if(settled)return;if(!blob.size||blob.size>32*1024*1024){fail(Error('OUTPUT_BOUND'));return;}settled=true;cleanup();resolve({blob,name:video?'local-preview.webm':'local-preview.wav',record:{version:1,category:item.category,sourceRevision:item.sourceRevision,adapterVersion:item.adapterVersion,at:new Date().toISOString(),mime:blob.type,bytes:blob.size,...details}});};
  signal.addEventListener('abort',cancel,{once:true});document.addEventListener('visibilitychange',visibility);watchdog=setTimeout(()=>fail(Error('ADAPTER_TIMEOUT')),seconds*1000+20000);
  if(signal.aborted){cancel();return;}if(document.hidden){visibility();return;}
  void(async()=>{
   if(!context||!ready||!await ready)throw Error('MEDIA_CAPABILITY_UNAVAILABLE');if(settled)return;
   const mime=video&&globalThis.MediaRecorder?['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm'].find(value=>MediaRecorder.isTypeSupported(value)):null;
   player=document.createElement(video?'video':'audio');player.style.maxWidth='100%';player.playsInline=true;player.preload='metadata';player.controls=false;
   canvas=document.createElement('canvas');canvas.hidden=true;
   if(video&&(!mime||!canvas.captureStream))throw Error('MEDIA_CAPABILITY_UNAVAILABLE');
   const preview=document.createElement('div');preview.append(player,canvas);onPreview(preview);
   url=URL.createObjectURL(item.sources[0]);player.src=url;
   await new Promise((resolve,reject)=>{player.onloadedmetadata=resolve;player.onerror=()=>reject(Error('MEDIA_DECODE_UNAVAILABLE'));});if(settled)return;
   if(!Number.isFinite(player.duration)||player.duration<=0)throw Error('MEDIA_DURATION_UNAVAILABLE');
   if(video&&(player.videoWidth<1||player.videoHeight<1||player.videoWidth*player.videoHeight>9000000||player.videoWidth>4096||player.videoHeight>4096))throw Error('MEDIA_DIMENSION_BOUND');
   source=context.createMediaElementSource(player);player.volume=1;player.muted=false;
   if(video){
    const ratio=Math.min(1,1280/player.videoWidth,720/player.videoHeight);canvas.width=Math.max(2,Math.floor(player.videoWidth*ratio/2)*2);canvas.height=Math.max(2,Math.floor(player.videoHeight*ratio/2)*2);const surface=canvas.getContext('2d');if(!surface)throw Error('MEDIA_CAPABILITY_UNAVAILABLE');
    const destination=context.createMediaStreamDestination();source.connect(destination);stream=canvas.captureStream(24);for(const track of destination.stream.getAudioTracks())stream.addTrack(track);
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1500000,audioBitsPerSecond:128000});const chunks=[];let bytes=0;
    recorder.ondataavailable=event=>{if(settled||!event.data.size)return;bytes+=event.data.size;if(bytes>32*1024*1024){fail(Error('OUTPUT_BOUND'));return;}chunks.push(event.data);};
    recorder.onerror=()=>fail(Error('MEDIA_ENCODER_UNAVAILABLE'));
    recorder.onstop=()=>{if(settled)return;const actualMime=recorder.mimeType;void(async()=>{const blob=new Blob(chunks,{type:actualMime});const header=new Uint8Array(await blob.slice(0,4).arrayBuffer());if(settled)return;if(![26,69,223,163].every((value,index)=>header[index]===value))throw Error('OUTPUT_SIGNATURE');finish(blob,{width:canvas.width,height:canvas.height,requestedDuration:seconds,requestedFrameRate:24,validation:'WebM signature; exact container duration and visual equivalence remain unverified'});})().catch(fail);};
    const stop=()=>{if(recorder?.state==='recording'){player.pause();recorder.stop();}};
    const draw=()=>{if(settled)return;if(player.ended||player.currentTime>=seconds){stop();return;}surface.drawImage(player,0,0,canvas.width,canvas.height);if(performance.now()-lastProgress>=1000){lastProgress=performance.now();onProgress({stage:'encoding-video',mediaSeconds:player.currentTime});}if(player.requestVideoFrameCallback)frameCallback=player.requestVideoFrameCallback(draw);};
    player.onended=stop;recorder.start(1000);await player.play();if(settled)return;draw();if(!player.requestVideoFrameCallback)frameTimer=setInterval(draw,1000/24);
   }else{
    if(!context.audioWorklet||context.sampleRate<8000||context.sampleRate>96000)throw Error('MEDIA_CAPABILITY_UNAVAILABLE');
    if(!workletLoads.has(context))workletLoads.set(context,context.audioWorklet.addModule(browserWorkerURL('browser-native-audio-worklet')));await workletLoads.get(context);if(settled)return;
    const rate=context.sampleRate,chunks=[];let frames=0;
    node=new AudioWorkletNode(context,'browser-native-pcm',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit',processorOptions:{maximumFrames:Math.floor(rate*seconds)}});
    silence=context.createGain();silence.gain.value=0;source.connect(node);node.connect(silence);silence.connect(context.destination);
    node.port.onmessage=event=>{if(settled)return;try{if(event.data.samples instanceof ArrayBuffer){if(event.data.samples.byteLength>65536)throw Error('AUDIO_BLOCK_BOUND');const samples=new Float32Array(event.data.samples);if(samples.length!==event.data.frames*2||frames+event.data.frames>rate*seconds)throw Error('AUDIO_FRAME_BOUND');chunks.push(samples);frames+=event.data.frames;if(performance.now()-lastProgress>=1000){lastProgress=performance.now();onProgress({stage:'encoding-audio',mediaSeconds:frames/rate});}}if(event.data.done){if(event.data.frames!==frames)throw Error('AUDIO_FRAME_MISMATCH');finish(wav(chunks,frames,rate),{frames,sampleRate:rate,channels:2,bitsPerSample:16,validation:'PCM header/data length and observed sample count matched'});}}catch(error){fail(error);}};
    node.onprocessorerror=()=>fail(Error('MEDIA_WORKLET_UNAVAILABLE'));player.onended=()=>node?.port.postMessage('finish');await player.play();
   }
  })().catch(fail);
 });
}
for(const category of ['audio','video'])registerBrowserConverter(category,{version:'browser-media-preview-2',maximumOutput:32*1024*1024,prepare,release,async admit(sources,options){if(!Array.isArray(sources)||sources.length!==1||!(sources[0] instanceof Blob)||sources[0].size>32*1024*1024||!options||Object.keys(options).some(key=>key!=='seconds')||!Number.isInteger(options.seconds)||options.seconds<1||options.seconds>60||!await signature(sources[0],category==='video'))throw Error('MEDIA_INPUT_OR_OPTIONS');return {seconds:options.seconds};},run:execute});
function wav(chunks,frames,rate){if(!Number.isInteger(frames)||frames<1||frames>rate*60||rate<8000||rate>96000)throw Error('Audio bounds');const bytes=new ArrayBuffer(44+frames*4),view=new DataView(bytes);const word=(at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};word(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,frames*4,true);let at=44;for(const chunk of chunks)for(const value of chunk){if(at>=bytes.byteLength)throw Error('Frame mismatch');const bounded=Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;view.setInt16(at,Math.round(bounded<0?bounded*32768:bounded*32767),true);at+=2;}if(at!==bytes.byteLength)throw Error('Frame mismatch');return new Blob([bytes],{type:'audio/wav'});}
async function signature(file,video){const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer()),text=new TextDecoder('latin1').decode(bytes);const webm=[26,69,223,163].every((value,index)=>bytes[index]===value),mp4=text.slice(4,8)==='ftyp';if(video)return webm||mp4;return webm||mp4||text.startsWith('fLaC')||text.startsWith('OggS')||text.startsWith('ID3')||(bytes[0]===255&&(bytes[1]&224)===224)||(text.startsWith('RIFF')&&text.slice(8,12)==='WAVE');}


