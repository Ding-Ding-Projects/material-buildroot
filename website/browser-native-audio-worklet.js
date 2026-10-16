class BrowserNativePCM extends AudioWorkletProcessor {
 constructor(options){super();this.frames=0;this.maximum=Math.min(sampleRate*60,Math.max(1,options.processorOptions.maximumFrames));this.done=false;this.port.onmessage=event=>{if(event.data==='finish')this.finish();};}
 finish(){if(this.done)return;this.done=true;this.port.postMessage({done:true,frames:this.frames,sampleRate});}
 process(inputs){if(this.done)return false;const channels=inputs[0];if(!channels?.length||!channels[0]?.length)return true;const length=Math.min(channels[0].length,this.maximum-this.frames);const samples=new Float32Array(length*2);for(let index=0;index<length;index++){samples[index*2]=channels[0][index]||0;samples[index*2+1]=(channels[1]||channels[0])[index]||0;}this.frames+=length;this.port.postMessage({samples:samples.buffer,frames:length},[samples.buffer]);if(this.frames>=this.maximum)this.finish();return !this.done;}
}
registerProcessor('browser-native-pcm',BrowserNativePCM);
