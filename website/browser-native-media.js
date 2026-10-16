import './browser-native-media-engine.js';
import {bindDurableConverter} from './browser-native-queue-bindings.js';
import {mountLocalSearch} from './browser-native-search-mount.js';
import {mountBrowserExport} from './browser-native-exports.js';
import {browserCopy} from './browser-native-tone.js';
function mountMedia(visitor,video){
 const l=(en,zh)=>browserCopy(en,zh),root=document.createElement('section');root.className='visitor-card';root.id=video?'browser-native-video':'browser-native-audio';const localized=[];
 const make=(tag,en='',zh='',parent=root)=>{const element=document.createElement(tag);if(en)localized.push(()=>element.textContent=l(en,zh));parent.append(element);return element;};
 const title=make('h2',video?'Durable WebM preview conversion':'Durable WAV preview conversion',video?'持久 WebM 預覽轉換':'持久 WAV 預覽轉換');title.id=root.id+'-title';root.setAttribute('aria-labelledby',title.id);
 make('p','The selected source, typed duration, output and transition history are retained in the shared browser queue. Inputs are at most 32 MiB and previews 1–60 media seconds. Nothing is uploaded; no microphone, camera, screen capture or host executable is used. Browser data is not encrypted by this converter.','所選來源、型別化秒數、輸出同變更歷史會保留喺共用瀏覽器佇列。輸入最多 32 MiB，預覽為 1 至 60 個媒體秒。資料唔會上載，亦唔使用咪高峰、鏡頭、畫面擷取或主機可執行檔。此轉換器唔會加密瀏覽器資料。');
 const input=make('input');input.type='file';input.accept=video?'.mp4,.webm,video/mp4,video/webm':'.wav,.mp3,.flac,.ogg,.webm,.m4a,.mp4';input.style.maxWidth='100%';localized.push(()=>input.setAttribute('aria-label',l('Choose local media','選擇本機媒體')));
 const duration=make('md-outlined-text-field');duration.className='visitor-field';duration.type='number';duration.min='1';duration.max='60';duration.step='1';duration.value='30';localized.push(()=>duration.label=l('Preview seconds, maximum 60','預覽秒數，最多 60'));
 make('p',video?'This route re-encodes a deliberately trimmed WebM preview within 1280×720, requesting 24 frames per second. Detail, metadata, subtitles, chapters and tracks can be lost. Exact container timing is unverified. MP4 output and lossless remuxing are unavailable.':'This route deliberately trims and resamples/downmixes input into PCM16 stereo WAV at the actual browser context sample rate. Original metadata and extra channels are not retained. MP3/FLAC encoding is unavailable.',video?'此路線會重新編碼刻意裁短嘅 WebM 預覽，尺寸在 1280×720 內，要求每秒 24 幀。細節、中繼資料、字幕、章節同音軌可能損失，確切容器時序未驗證。唔提供 MP4 輸出或無損重新封裝。':'此路線會刻意裁短並重新取樣／混音，按實際瀏覽器環境取樣率產生 PCM16 立體聲 WAV。原有中繼資料同額外聲道不會保留，唔提供 MP3／FLAC 編碼。');
 make('p','Media conversion needs a visible page and browser playback permission. Hiding the page interrupts the current attempt without discarding its queued inputs. Revalidate and explicitly retry retained intent; no hidden replay is started.','媒體轉換需要可見頁面同瀏覽器播放許可。隱藏頁面會中斷目前嘗試，但唔會丟棄佇列輸入。請重新驗證並明確重試保留意圖，唔會喺背景偷偷重播。');
 const actions=make('div');actions.className='visitor-actions';const run=make('md-outlined-button','Store and run this preview','儲存並執行此預覽',actions),cancel=make('md-text-button','Request cancellation','要求取消',actions),download=make('md-outlined-button','Download retained preview','下載保留預覽',actions);download.disabled=true;
 const status=make('p');status.role='status';status.setAttribute('aria-live','polite');const preview=make('div');let output,record,resultUrl;
 const report=(en,zh)=>status.textContent=l(en,zh);
 bindDurableConverter({category:video?'video':'audio',run,cancel,inputs:[input,duration],report,onPreview:element=>preview.replaceChildren(element),
  request(){const source=input.files?.[0];if(!source)throw Error('Choose media');return {category:video?'video':'audio',name:source.name.slice(0,255),sources:[source],options:{seconds:Number(duration.value)}};},
  onResult(item){output={blob:item.output,name:item.outputName};record=item.record;download.disabled=false;preview.replaceChildren();if(resultUrl)URL.revokeObjectURL(resultUrl);resultUrl=URL.createObjectURL(item.output);const media=make(video?'video':'audio','','',preview);media.controls=true;media.preload='metadata';media.style.maxWidth='100%';media.src=resultUrl;}
 });
 download.addEventListener('click',()=>{if(!output)return;const url=URL.createObjectURL(output.blob),a=make('a');a.href=url;a.download=output.name;a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);report('Retained preview download requested. Final save remains separate.','已要求下載保留預覽，最後儲存屬另一項狀態。');});
 const holder=make('div');duration.before(holder);mountLocalSearch(holder,video?'Search video options':'Search audio options',video?'搜尋影片選項':'搜尋音訊選項',[{id:'duration',text:'Preview duration seconds 預覽 秒數'}],ids=>duration.hidden=!ids.has('duration'));
 mountBrowserExport(root,()=>{if(!record)throw Error('No result');return record;},video?'video-preview-record':'audio-preview-record','The selected durable preview record; media bytes excluded');
 visitor.append(root);localized.forEach(update=>update());report('No preview selected. Existing jobs remain available in the shared queue.','未選擇預覽，現有工作仍可喺共用佇列查看。');document.querySelector('#language')?.addEventListener('change',()=>localized.forEach(update=>update()));window.addEventListener('pagehide',()=>{if(resultUrl)URL.revokeObjectURL(resultUrl);},{once:true});
}
export function mountBrowserMedia(visitor){mountMedia(visitor,false);mountMedia(visitor,true);}
