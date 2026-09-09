(()=>{var ie=(e=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(e,{get:(t,n)=>(typeof require<"u"?require:t)[n]}):e)(function(e){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')});var V={sttModel:"large-v3",language:"pl",backendUrl:"http://127.0.0.1:8000",audioPresetPath:"",maxCharsPerLine:42,maxLines:2,preferredMinChars:32,preferredMaxChars:42,minDurationMs:1e3,maxDurationMs:7e3,autoPunctuation:!0,smartSentenceSplit:!0,removeRepetitions:!0,aiCorrection:!1,exportFolder:"",devLogging:!1};var ke="settings.json",I={...V},it=!1;async function Te(){try{return await ie("uxp").storage.localFileSystem.getDataFolder()}catch{return null}}async function X(){let e=await Te();if(e)try{let n=await(await e.getEntry(ke)).read(),a=JSON.parse(n);I={...V,...a}}catch{I={...V}}return it=!0,{...I}}async function st(e){I={...V,...e||I};let t=await Te();if(t)try{await(await t.createEntry(ke,{overwrite:!0})).write(JSON.stringify(I,null,2))}catch{}return{...I}}function F(){return{...I}}async function T(e,t){return I={...I,[e]:t},st(I)}var Q={debug:10,info:20,warn:30,error:40},Ie=!1,Pe=Q.warn,se=[],ct=300;function Ne({devLogging:e}){Ie=!!e,Pe=Ie?Q.debug:Q.warn}function Z(e,t,n,a){if(Q[e]<Pe)return;let r={ts:new Date().toISOString(),level:e,scope:t,message:n,data:a};se.push(r),se.length>ct&&se.shift();let o=`[${r.ts}] [${e.toUpperCase()}] [${t}] ${n}`,i=console[e]||console.log;a!==void 0?i(o,a):i(o)}function S(e){return{debug:(t,n)=>Z("debug",e,t,n),info:(t,n)=>Z("info",e,t,n),warn:(t,n)=>Z("warn",e,t,n),error:(t,n)=>Z("error",e,t,n)}}var c={NO_ACTIVE_SEQUENCE:"NO_ACTIVE_SEQUENCE",NO_AUDIO_TRACKS:"NO_AUDIO_TRACKS",NO_CLIPS_ON_TRACK:"NO_CLIPS_ON_TRACK",EMPTY_RANGE:"EMPTY_RANGE",AUDIO_EXPORT_FAILED:"AUDIO_EXPORT_FAILED",BACKEND_UNREACHABLE:"BACKEND_UNREACHABLE",MODEL_UNAVAILABLE:"MODEL_UNAVAILABLE",TRANSCRIPTION_CANCELLED:"TRANSCRIPTION_CANCELLED",TRANSCRIPTION_FAILED:"TRANSCRIPTION_FAILED",DISK_FULL:"DISK_FULL",SRT_WRITE_FAILED:"SRT_WRITE_FAILED",UNSUPPORTED_FORMAT:"UNSUPPORTED_FORMAT",CAPTION_API_UNAVAILABLE:"CAPTION_API_UNAVAILABLE",UNKNOWN:"UNKNOWN"},ce={[c.NO_ACTIVE_SEQUENCE]:"Brak otwartej sekwencji. Otw\xF3rz sekwencj\u0119 w Premiere Pro.",[c.NO_AUDIO_TRACKS]:"Sekwencja nie zawiera \u015Bcie\u017Cek audio.",[c.NO_CLIPS_ON_TRACK]:"Wybrana \u015Bcie\u017Cka audio nie zawiera klip\xF3w.",[c.EMPTY_RANGE]:"Wybrany zakres jest pusty. Ustaw punkty In/Out lub wybierz ca\u0142\u0105 sekwencj\u0119.",[c.AUDIO_EXPORT_FAILED]:"Nie uda\u0142o si\u0119 wyeksportowa\u0107 audio z sekwencji.",[c.BACKEND_UNREACHABLE]:"Brak po\u0142\u0105czenia z lokalnym silnikiem transkrypcji. Uruchom backend i sprawd\u017A adres w ustawieniach.",[c.MODEL_UNAVAILABLE]:"Wybrany model transkrypcji jest niedost\u0119pny.",[c.TRANSCRIPTION_CANCELLED]:"Transkrypcja zosta\u0142a przerwana.",[c.TRANSCRIPTION_FAILED]:"Transkrypcja nie powiod\u0142a si\u0119.",[c.DISK_FULL]:"Brak miejsca na dysku, aby zapisa\u0107 pliki.",[c.SRT_WRITE_FAILED]:"Nie uda\u0142o si\u0119 zapisa\u0107 pliku SRT.",[c.UNSUPPORTED_FORMAT]:"Nieobs\u0142ugiwany format pliku.",[c.CAPTION_API_UNAVAILABLE]:"Tworzenie napis\xF3w w Premiere nie jest dost\u0119pne w tej wersji \u2014 zapisano plik SRT do importu.",[c.UNKNOWN]:"Wyst\u0105pi\u0142 nieoczekiwany b\u0142\u0105d."},d=class extends Error{constructor(t,{cause:n,userMessage:a,details:r}={}){let o=a||ce[t]||ce[c.UNKNOWN];super(o),this.name="AppError",this.code=t in ce?t:c.UNKNOWN,this.userMessage=o,this.details=r,n&&(this.cause=n)}};function Ce(e){let t=Number(e);return!t||!Number.isFinite(t)?0:254016e6/t}function q(e){return e==null?0:typeof e=="number"?e:typeof e.seconds=="number"?e.seconds:e.ticksNumber!=null?Number(e.ticksNumber)/254016e6:e.ticks!=null?Number(e.ticks)/254016e6:0}var Y=S("premiere");function P(){try{return ie("premierepro")}catch{return null}}async function ue(e){let t=e||P();if(!t)throw new d(c.NO_ACTIVE_SEQUENCE);let n=await t.Project.getActiveProject();if(!n)throw new d(c.NO_ACTIVE_SEQUENCE);return n}async function le(e){let t=e||P(),a=await(await ue(t)).getActiveSequence();if(!a)throw new d(c.NO_ACTIVE_SEQUENCE);return a}async function ut(e,t){try{let n=e?.Constants?.TrackItemType?.CLIP;if(n===void 0)return null;let a=await t.getTrackItems(n,!1);return Array.isArray(a)?a.length>0:null}catch(n){return Y.debug("trackHasClips: nie uda\u0142o si\u0119 odczyta\u0107 klip\xF3w",{error:String(n&&n.message)}),null}}async function lt(e,t){let n=t||P(),a=await e.getAudioTrackCount(),r=[];for(let o=0;o<a;o++){let i;try{i=await e.getAudioTrack(o)}catch{Y.warn("Nie uda\u0142o si\u0119 pobra\u0107 \u015Bcie\u017Cki audio",{index:o});continue}let s=o;try{let g=await i.getIndex();typeof g=="number"&&(s=g)}catch{}let p=null;try{p=await i.isMuted()}catch{}let f=await ut(n,i),m=i.name||`A${s+1}`;r.push({index:s,name:m,muted:p,hasClips:f})}return r}async function J(){let e=P();if(!e)return{available:!1,name:"(poza Premiere Pro)",fps:0,timebase:"",zeroPointSec:0,inPointSec:0,outPointSec:0,endSec:0,hasInOut:!1,audioTracks:[]};let t=await le(e),[n,a,r,o,i]=await Promise.all([G(()=>t.getTimebase(),""),G(()=>t.getZeroPoint(),null),G(()=>t.getInPoint(),null),G(()=>t.getOutPoint(),null),G(()=>t.getEndTime(),null)]),s=q(a),p=q(r),f=q(o),m=q(i),g=f>p&&(p>s||f<m),x=await lt(t,e),w={available:!0,name:t.name||"(bez nazwy)",fps:Ce(n),timebase:String(n||""),zeroPointSec:s,inPointSec:p,outPointSec:f,endSec:m,hasInOut:g,audioTracks:x};return Y.debug("describeActiveSequence",{name:w.name,fps:w.fps,tracks:x.length,hasInOut:g}),w}async function Le(e,t){if(t==null)return async()=>{};let n=await e.getAudioTrackCount(),a=[];for(let r=0;r<n;r++){let o;try{o=await e.getAudioTrack(r)}catch{continue}let i=r;try{let f=await o.getIndex();typeof f=="number"&&(i=f)}catch{}let s=!1;try{s=await o.isMuted()}catch{}a.push({track:o,wasMuted:s});let p=i!==t;if(p!==s)try{await o.setMute(p)}catch{Y.warn("Nie uda\u0142o si\u0119 zmieni\u0107 wyciszenia \u015Bcie\u017Cki",{idx:i})}}return async()=>{for(let{track:r,wasMuted:o}of a)try{await r.setMute(o)}catch{}}}async function G(e,t){try{return await e()}catch{return t}}function R(){try{return ie("uxp")}catch{return null}}function de(){let e=R();return e?e.storage.localFileSystem:null}function dt(e){return e&&e.indexOf("\\")!==-1?"\\":"/"}function pe(e,t){let n=dt(e);return`${e.replace(/[\\/]+$/,"")}${n}${t}`}async function pt(){let e=de();return e?e.getTemporaryFolder():null}async function ve(){let e=de();return e?e.getDataFolder():null}async function fe(e){let t=de();if(!t||!e)return!1;try{let n=await t.getEntryWithUrl(`file:${e}`);return!!n&&n.isFile}catch{return!1}}async function _e(e,t="psai",n=null){let a=n;if(!a){let i=await pt();if(!i)return null;a=i.nativePath}let r=new Date().toISOString().replace(/[:.]/g,"-"),o=Math.random().toString(36).slice(2,7);return pe(a,`${t}_${r}_${o}.${e}`)}var me=S("audio");async function Me(e){let{sequence:t,range:n="full",presetPath:a,outputDirNative:r=null,zeroPointSec:o=0,inPointSec:i=0,outPointSec:s=0,endSec:p=0}=e||{},f=P();if(!f)throw new d(c.AUDIO_EXPORT_FAILED,{userMessage:"Eksport audio dost\u0119pny tylko w Premiere Pro."});if(!t)throw new d(c.NO_ACTIVE_SEQUENCE);if(!a)throw new d(c.AUDIO_EXPORT_FAILED,{userMessage:"Nie wskazano presetu eksportu audio. Ustaw preset .epr (audio-only WAV) w Ustawieniach \u2014 instrukcja w docs/AUDIO_PRESET.md."});if(!await fe(a))throw new d(c.AUDIO_EXPORT_FAILED,{userMessage:"Preset eksportu audio nie istnieje pod wskazan\u0105 \u015Bcie\u017Ck\u0105. Popraw \u015Bcie\u017Ck\u0119 w Ustawieniach."});let m=await _e("wav","psai_audio",r);if(!m)throw new d(c.AUDIO_EXPORT_FAILED,{userMessage:"Nie uda\u0142o si\u0119 ustali\u0107 \u015Bcie\u017Cki wyj\u015Bciowej audio."});let g=ft(f),x=n!=="inout",w=x?o:i,b=Math.max(0,(x?p:s)-w),C=w-o;me.info("Eksport audio startuje",{range:n,exportFull:x,durationSec:b});let L=f.EncoderManager.getManager(),_=!1;try{_=await L.exportSequence(t,g,m,a,x)}catch(v){throw me.error("exportSequence rzuci\u0142 wyj\u0105tek",{error:String(v&&v.message)}),mt(v)}if(!_)throw new d(c.AUDIO_EXPORT_FAILED);if(!await fe(m))throw new d(c.AUDIO_EXPORT_FAILED,{userMessage:"Eksport zako\u0144czy\u0142 si\u0119, ale plik audio nie powsta\u0142. Sprawd\u017A preset i miejsce na dysku."});return me.info("Eksport audio zako\u0144czony",{durationSec:b}),{path:m,range:n,mediaStartSec:w,offsetSec:C,durationSec:b}}function ft(e){let t=e?.Constants?.ExportType;return t&&t.IMMEDIATELY!==void 0?t.IMMEDIATELY:t&&t.QUEUE_TO_AME!==void 0?t.QUEUE_TO_AME:0}function mt(e){let t=String(e&&e.message||"").toLowerCase();return t.includes("space")||t.includes("disk")||t.includes("miejsc")?new d(c.DISK_FULL,{cause:e}):new d(c.AUDIO_EXPORT_FAILED,{cause:e})}var Oe=S("stt");function Re(e){return(e||"").replace(/\/$/,"")}async function gt(e){try{return(await fetch(`${Re(e)}/health`,{method:"GET"})).ok}catch{return Oe.warn("Backend niedost\u0119pny",{url:e}),!1}}function wt(e){return new Promise(t=>setTimeout(t,e))}async function De(e,t){let n=Re(t.backendUrl);if(!n)throw new d(c.BACKEND_UNREACHABLE);if(!await gt(n))throw new d(c.BACKEND_UNREACHABLE);let{onProgress:a,signal:r}=t,o;try{let p=await fetch(`${n}/api/transcribe_path`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({audio_path:e,language:t.language||"pl",model:t.model||"large-v3",word_timestamps:t.wordTimestamps!==!1})});if(p.status===404)throw new d(c.AUDIO_EXPORT_FAILED,{userMessage:"Backend nie znalaz\u0142 pliku audio."});if(p.status===400)throw new d(c.UNSUPPORTED_FORMAT);if(!p.ok)throw new d(c.TRANSCRIPTION_FAILED);o=(await p.json()).job_id}catch(p){throw p instanceof d?p:new d(c.BACKEND_UNREACHABLE,{cause:p})}Oe.debug("Zlecono transkrypcj\u0119",{jobId:o,model:t.model});let i=!1,s=async()=>{i=!0;try{await fetch(`${n}/api/cancel/${o}`,{method:"POST"})}catch{}};r&&(r.aborted?await s():r.addEventListener("abort",s,{once:!0}));try{for(;;){if(i||r&&r.aborted)throw new d(c.TRANSCRIPTION_CANCELLED);let m;try{let g=await fetch(`${n}/api/status/${o}`,{method:"GET"});if(!g.ok)throw new Error(`status ${g.status}`);m=await g.json()}catch(g){throw new d(c.BACKEND_UNREACHABLE,{cause:g})}if(a&&typeof m.progress=="number"&&a({percent:m.progress,status:m.status_text||"Transkrypcja audio\u2026"}),m.status==="done")break;if(m.status==="cancelled")throw new d(c.TRANSCRIPTION_CANCELLED);if(m.status==="error")throw m.error==="audio_not_found"?new d(c.AUDIO_EXPORT_FAILED,{userMessage:"Backend nie znalaz\u0142 pliku audio."}):new d(c.TRANSCRIPTION_FAILED);await wt(600)}let p=await fetch(`${n}/api/result/${o}`,{method:"GET"});if(!p.ok)throw new d(c.TRANSCRIPTION_FAILED);let f=await p.json();return{language:f.language||"pl",duration:f.duration||0,segments:Array.isArray(f.segments)?f.segments:[]}}finally{r&&r.removeEventListener("abort",s)}}function ze(e,t){let n=Number(t)||0,a=o=>Math.max(0,Number(o)+n),r=(e.segments||[]).map(o=>({start:a(o.start),end:a(o.end),text:o.text,words:Array.isArray(o.words)?o.words.map(i=>({start:a(i.start),end:a(i.end),word:i.word})):[]}));return{language:e.language||"pl",duration:e.duration||0,segments:r}}var ee=Number.POSITIVE_INFINITY,Fe={maxCharsPerLine:42,maxLines:2,preferredMinChars:32,preferredMaxChars:42,minDurationMs:1e3,maxDurationMs:7e3,pauseThresholdSec:.6,mergeGapSec:.4,mergeTinyChars:15};function je(e){return/[.!?…]["»)\]]?$/.test(e||"")}function ht(e){return/[,;:–—-]$/.test(e||"")}function xt(e){return/\d/.test(e||"")&&/^[\d.,%°:/-]+$/.test(e||"")}function Ue(e){if(!e)return!1;let t=e[0];return t===t.toUpperCase()&&t!==t.toLowerCase()}function $e(e,t,n){let a=0;for(let r=t;r<n;r++)a+=e[r].length;return a+(n-t-1)}function yt(e,t,n,a,r){let o=$e(e,t,n);if(o>r.maxCharsPerLine&&n-t>1)return ee;let i;o<r.preferredMinChars?i=(r.preferredMinChars-o)*(r.preferredMinChars-o):o>r.preferredMaxChars?i=(o-r.preferredMaxChars)*(o-r.preferredMaxChars)*2:i=0,o>r.maxCharsPerLine&&n-t===1&&(i+=100+(o-r.maxCharsPerLine)*50),n-t===1&&o<8&&(i+=40);let s=e[n-1];return je(s)?i-=15:ht(s)&&(i-=6),n<a&&xt(s)&&(i+=60),n<a&&Ue(s)&&Ue(e[n])&&(i+=25),i}function Be(e,t){let n={...Fe,...t||{}},a=e.length;if(a===0)return{lines:[],cost:0,maxLen:0};let r=new Map,o=(f,m)=>f*100+m;function i(f,m){if(f===a)return{cost:0,lines:[]};if(m===0)return{cost:ee,lines:null};let g=o(f,m);if(r.has(g))return r.get(g);let x={cost:ee,lines:null};for(let w=f+1;w<=a&&!($e(e,f,w)>n.maxCharsPerLine&&w>f+1);w++){let b=yt(e,f,w,a,n);if(!Number.isFinite(b))continue;let C=i(w,m-1);if(C.lines===null)continue;let L=b+C.cost;L<x.cost&&(x={cost:L,lines:[e.slice(f,w).join(" ")].concat(C.lines)})}return r.set(g,x),x}let s=i(0,n.maxLines);if(s.lines===null)return null;let p=s.lines.reduce((f,m)=>Math.max(f,m.length),0);return{lines:s.lines,cost:s.cost,maxLen:p}}function We(e,t){let n=Be(e.map(a=>a.word),t);return!!n&&n.maxLen<=t.maxCharsPerLine}function ge(e){return e.reduce((t,n,a)=>t+n.word.length+(a?1:0),0)}function Et(e){let t=[];for(let n of e||[])if(Array.isArray(n.words)&&n.words.length)for(let a of n.words){let r=(a.word||"").trim();r&&t.push({start:Number(a.start),end:Number(a.end),word:r})}else{let a=(n.text||"").trim().split(/\s+/).filter(Boolean),r=Math.max(0,Number(n.end)-Number(n.start)),o=a.length?r/a.length:0;a.forEach((i,s)=>{t.push({start:Number(n.start)+s*o,end:Number(n.start)+(s+1)*o,word:i})})}return t}function St(e,t){let n=[],a=[];for(let r=0;r<e.length;r++){let o=e[r];if(a.length){let i=o.start-a[a.length-1].end,s=o.end-a[0].start,p=a.concat([o]);if(i>t.pauseThresholdSec&&ge(a)>=t.preferredMinChars){n.push(a),a=[o];continue}if(!We(p,t)||s*1e3>t.maxDurationMs){n.push(a),a=[o];continue}a=p}else a=[o];je(a[a.length-1].word)&&(n.push(a),a=[])}return a.length&&n.push(a),n}function bt(e,t){let n=[];for(let a of e){if(n.length){let r=n[n.length-1],o=r.concat(a),i=a[0].start-r[r.length-1].end,s=a[a.length-1].end-r[0].start;if(Math.min(ge(r),ge(a))<t.mergeTinyChars&&i<=t.mergeGapSec&&s*1e3<=t.maxDurationMs&&We(o,t)){n[n.length-1]=o;continue}}n.push(a)}return n}function At(e,t){let n=t.minDurationMs/1e3,a=t.maxDurationMs/1e3,r=.001;for(let o of e)o.end-o.start>a&&(o.end=o.start+a),o.end<=o.start&&(o.end=o.start+r);for(let o=0;o<e.length;o++){let i=o+1<e.length?e[o+1].start:ee;e[o].end>i&&(e[o].end=i-r),e[o].end-e[o].start<n&&(e[o].end=Math.min(e[o].start+n,i-r)),e[o].end<=e[o].start&&(e[o].end=e[o].start+r)}return e}function Ke(e,t){let n={...Fe,...t||{}},a=Et(e).filter(i=>Number.isFinite(i.start)&&Number.isFinite(i.end));if(!a.length)return[];let r=St(a,n);r=bt(r,n);let o=[];for(let i of r){if(!i.length)continue;let s=Be(i.map(p=>p.word),n);!s||!s.lines.length||o.push({start:i[0].start,end:i[i.length-1].end,lines:s.lines})}return o.sort((i,s)=>i.start-s.start),At(o,n)}function Ve(e){let t=Math.max(0,Number(e)||0),n=Math.round(t*1e3),a=n%1e3,r=(n-a)/1e3,o=r%60,i=(r-o)/60,s=i%60,p=(i-s)/60,f=g=>String(g).padStart(2,"0"),m=g=>String(g).padStart(3,"0");return`${f(p)}:${f(s)}:${f(o)},${m(a)}`}function kt(e){let n=(e||[]).map(r=>({start:Math.max(0,Number(r.start)||0),end:Math.max(0,Number(r.end)||0),lines:(r.lines||[]).map(o=>String(o).trim()).filter(Boolean)})).filter(r=>r.lines.length>0).sort((r,o)=>r.start-o.start||r.end-o.end),a=[];for(let r of n){if(r.end<=r.start&&(r.end=r.start+.001),a.length){let o=a[a.length-1];r.start<o.end&&(r.start=o.end,r.end<=r.start&&(r.end=r.start+.001))}a.push(r)}return a}function qe(e){let t=kt(e),n=[],a=1;for(let r of t){let o=`${Ve(r.start)} --> ${Ve(r.end)}`;n.push(`${a}
${o}
${r.lines.join(`
`)}`),a+=1}return n.join(`

`)+(n.length?`
`:"")}var Tt=S("pipeline");function It(e,t,n){return e+Math.max(0,Math.min(100,n))/100*t}async function Ge({settings:e,selection:t,onProgress:n,signal:a}){let r=(b,C)=>{n&&n({percent:Math.round(b),status:C})},o=()=>{if(a&&a.aborted)throw new d(c.TRANSCRIPTION_CANCELLED)};r(1,"Odczyt sekwencji\u2026");let i=await le(),s=await J();if(!s.audioTracks.length)throw new d(c.NO_AUDIO_TRACKS);if(t.range==="inout"&&!s.hasInOut)throw new d(c.EMPTY_RANGE);let p=s.audioTracks.find(b=>b.index===t.audioTrackIndex);if(t.audioTrackIndex!=null&&p&&p.hasClips===!1)throw new d(c.NO_CLIPS_ON_TRACK);o(),r(5,"Eksport audio z sekwencji\u2026");let f=await Le(i,t.audioTrackIndex),m;try{m=await Me({sequence:i,range:t.range,presetPath:e.audioPresetPath,zeroPointSec:s.zeroPointSec,inPointSec:s.inPointSec,outPointSec:s.outPointSec,endSec:s.endSec})}finally{await f()}r(30,"Audio gotowe. Transkrypcja\u2026"),o();let g=await De(m.path,{backendUrl:e.backendUrl,language:e.language||"pl",model:e.sttModel||"large-v3",wordTimestamps:!0,signal:a,onProgress:b=>r(It(30,60,b.percent||0),b.status||"Transkrypcja audio\u2026")});o(),r(91,"Dopasowanie czasu do sekwencji\u2026");let x=ze(g,m.offsetSec);r(94,"Segmentacja napis\xF3w\u2026");let w=Ke(x.segments,{maxCharsPerLine:e.maxCharsPerLine,maxLines:e.maxLines,preferredMinChars:e.preferredMinChars,preferredMaxChars:e.preferredMaxChars,minDurationMs:e.minDurationMs,maxDurationMs:e.maxDurationMs});if(!w.length)throw new d(c.TRANSCRIPTION_FAILED,{userMessage:"Nie wykryto mowy do utworzenia napis\xF3w."});r(98,"Generowanie SRT\u2026");let N=qe(w);return r(100,`Gotowe: ${w.length} napis\xF3w.`),Tt.info("Pipeline zako\u0144czony",{cues:w.length,language:x.language}),{srtContent:N,cues:w,offsetSec:m.offsetSec,language:x.language}}var we=S("export");function He(){let e=R();return e&&e.storage&&e.storage.formats?e.storage.formats.utf8:void 0}async function Pt(e){let t=R();if(!t||!e)return null;try{let n=await t.storage.localFileSystem.getEntryWithUrl(`file:${e}`);return n&&n.isFolder?n:null}catch{return null}}async function he(e,{dirNative:t=null,fileName:n="napisy.srt"}={}){if(!R())throw new d(c.SRT_WRITE_FAILED,{userMessage:"Zapis dost\u0119pny tylko w \u015Brodowisku pluginu."});let r=t?await Pt(t):null;if(r||(r=await ve()),!r)throw new d(c.SRT_WRITE_FAILED);try{let o=await r.createFile(n,{overwrite:!0});await o.write(e,{format:He()});let i=o.nativePath||pe(r.nativePath||"",n);return we.info("Zapisano SRT",{fileName:n}),{path:i,fileName:n}}catch(o){we.error("B\u0142\u0105d zapisu SRT",{error:String(o&&o.message)});let i=String(o&&o.message||"").toLowerCase();throw i.includes("space")||i.includes("disk")?new d(c.DISK_FULL,{cause:o}):new d(c.SRT_WRITE_FAILED,{cause:o})}}async function Xe(e,t="napisy.srt"){let n=R();if(!n)throw new d(c.SRT_WRITE_FAILED);let a;try{a=await n.storage.localFileSystem.getFileForSaving(t,{types:["srt"]})}catch(r){throw new d(c.SRT_WRITE_FAILED,{cause:r})}if(!a)return null;try{return await a.write(e,{format:He()}),{path:a.nativePath||t,fileName:a.name||t}}catch(r){throw new d(c.SRT_WRITE_FAILED,{cause:r})}}async function Ze(e){let t=R();if(!t||!e)return!1;try{if(t.shell&&t.shell.openPath)return await t.shell.openPath(e),!0}catch(n){we.warn("Nie uda\u0142o si\u0119 otworzy\u0107 folderu",{error:String(n&&n.message)})}return!1}var xe=S("premiere");async function Qe(e){let t=P();if(!t)throw new d(c.CAPTION_API_UNAVAILABLE,{userMessage:"Tworzenie napis\xF3w w Premiere dost\u0119pne tylko w \u015Brodowisku Premiere Pro."});if(!e)throw new d(c.SRT_WRITE_FAILED,{userMessage:"Brak pliku SRT do zaimportowania."});let n=await ue(t),a=null;try{a=await n.getRootItem()}catch(r){xe.debug("getRootItem niedost\u0119pne",{error:String(r&&r.message)})}try{if(!await n.importFiles([e],!0,a,!1))throw new d(c.CAPTION_API_UNAVAILABLE);return xe.info("Zaimportowano SRT do projektu jako element napis\xF3w"),{imported:!0,placedOnTimeline:!1,note:"SRT zaimportowano do projektu jako element napis\xF3w. Umieszczenie na \u015Bcie\u017Cce napis\xF3w sekwencji wykonaj r\u0119cznie (przeci\u0105gnij element na sekwencj\u0119) \u2014 obecne API Premiere UXP nie pozwala zrobi\u0107 tego automatycznie."}}catch(r){throw r instanceof d?r:(xe.warn("importFiles nie powiod\u0142o si\u0119",{error:String(r&&r.message)}),new d(c.CAPTION_API_UNAVAILABLE,{cause:r}))}}var Ye=S("ui");function l(e,t={},n=[]){let a=document.createElement(e);for(let[r,o]of Object.entries(t))r==="class"?a.className=o:r==="text"?a.textContent=o:r.startsWith("on")&&typeof o=="function"?a.addEventListener(r.slice(2),o):a.setAttribute(r,o);for(let r of[].concat(n))r&&a.appendChild(r);return a}function k(e,t){return l("div",{class:"field"},[l("label",{text:e}),t])}function te(e,t,n,a){let r=l("input",{type:"checkbox",id:e});return r.checked=!!n,r.addEventListener("change",()=>a(r.checked)),l("label",{class:"check",for:e},[r,document.createTextNode(t)])}async function Je(e){await X();let t=F(),n=P()!==null,a=l("h1",{class:"title"},[document.createTextNode("POLISH SUBTITLE AI"),l("span",{class:"sub",text:"Automatyczne polskie napisy z timeline"})]),r=l("div",{class:"value",text:"\u2026"}),o=l("button",{class:"btn",id:"refresh",text:"Od\u015Bwie\u017C"}),i=l("div",{class:"muted",id:"seqMeta",text:""}),s=l("select",{id:"audioTrack"});s.appendChild(l("option",{value:"",text:"\u2014"}));let p=l("select",{id:"range"}),f=l("option",{value:"full",text:"Ca\u0142a sekwencja"}),m=l("option",{value:"inout",text:"Zakres In/Out"});p.appendChild(f),p.appendChild(m);let g=l("div",{class:"field-row"},[k("Sekwencja",r)]),x=l("div",{class:"field-row"},[l("div",{class:"field",style:"flex:1"},[l("label",{text:"Sekwencja"}),r]),l("div",{class:"field",style:"flex:0 0 auto; justify-content:flex-end"},[l("label",{text:" "}),o])]),w=l("div",{class:"section"},[x,i,l("div",{class:"field-row"},[k("\u015Acie\u017Cka audio",s),k("Zakres",p)])]),N=l("select",{id:"model"});for(let u of["tiny","base","small","medium","large-v3"]){let h=l("option",{value:u,text:u==="large-v3"?"Whisper large-v3 (zalecany)":`Whisper ${u}`});u===t.sttModel&&(h.selected=!0),N.appendChild(h)}N.addEventListener("change",()=>T("sttModel",N.value));let b=l("div",{class:"value",text:"Polski"}),C=l("div",{class:"section"},[l("div",{class:"field-row"},[k("Model",N),k("J\u0119zyk",b)])]),L=l("input",{type:"number",id:"maxChars",min:"20",max:"60"});L.value=t.maxCharsPerLine,L.addEventListener("change",()=>T("maxCharsPerLine",ne(L,20,60)));let _=l("input",{type:"number",id:"maxLines",min:"1",max:"3"});_.value=t.maxLines,_.addEventListener("change",()=>T("maxLines",ne(_,1,3)));let v=l("input",{type:"number",id:"minDur",min:"200",max:"5000",step:"100"});v.value=t.minDurationMs,v.addEventListener("change",()=>T("minDurationMs",ne(v,200,5e3)));let H=l("input",{type:"number",id:"maxDur",min:"2000",max:"15000",step:"100"});H.value=t.maxDurationMs,H.addEventListener("change",()=>T("maxDurationMs",ne(H,2e3,15e3)));let tt=l("details",{class:"settings section"},[l("summary",{text:"Ustawienia napis\xF3w"}),l("div",{class:"field-row"},[k("Maks. znak\xF3w / linia",L),k("Maks. liczba linii",_)]),l("div",{class:"field-row"},[k("Min. czas (ms)",v),k("Maks. czas (ms)",H)]),l("div",{class:"divider"}),(()=>{let u=l("input",{type:"text",id:"audioPreset",placeholder:"\u015Acie\u017Cka do presetu .epr (audio-only WAV)"});return u.value=t.audioPresetPath||"",u.addEventListener("change",()=>T("audioPresetPath",u.value.trim())),k("Preset eksportu audio (.epr)",u)})(),(()=>{let u=l("input",{type:"text",id:"backendUrl",placeholder:"http://127.0.0.1:8000"});return u.value=t.backendUrl||"",u.addEventListener("change",()=>T("backendUrl",u.value.trim())),k("Adres backendu STT",u)})(),l("div",{class:"divider"}),te("optPunct","Automatyczna interpunkcja",t.autoPunctuation,u=>T("autoPunctuation",u)),te("optSplit","Inteligentny podzia\u0142 zda\u0144",t.smartSentenceSplit,u=>T("smartSentenceSplit",u)),te("optRep","Usuwanie zb\u0119dnych powt\xF3rze\u0144",t.removeRepetitions,u=>T("removeRepetitions",u)),te("optAi","Korekta AI (opcjonalna)",t.aiCorrection,u=>T("aiCorrection",u))]),j=l("button",{class:"btn btn-primary",id:"generate",text:"GENERUJ NAPISY"}),$=l("button",{class:"btn btn-danger",id:"cancel",text:"Anuluj"});$.disabled=!0,j.disabled=!n;let D=l("div",{class:"bar"}),nt=l("div",{class:"progress"},[D]),y=l("div",{class:"status",id:"status",text:""}),rt=l("div",{class:"section"},[l("div",{class:"actions-row"},[j,$]),k("Post\u0119p",nt),k("Status",y)]),B=l("button",{class:"btn",id:"exportSrt",text:"EKSPORTUJ SRT"}),W=l("button",{class:"btn",id:"createCaptions",text:"UTW\xD3RZ NAPISY W PREMIERE"}),M=l("button",{class:"btn",id:"openFolder",text:"OTW\xD3RZ FOLDER"});[B,W,M].forEach(u=>u.disabled=!0);let at=l("div",{class:"section actions"},[B,W,M]),ot=l("div",{class:"muted"},[document.createTextNode(n?"Napisy PL z audio timeline \xB7 lokalny Whisper":"Uwaga: uruchomiono poza Premiere Pro (podgl\u0105d UI).")]);e.innerHTML="",[a,w,C,tt,rt,at,ot].forEach(u=>e.appendChild(u));async function ae(){A(y,"Odczyt sekwencji\u2026");try{let u=await J();if(!u.available){r.textContent="(poza Premiere Pro)",i.textContent="Podgl\u0105d UI \u2014 uruchom w Premiere Pro, aby odczyta\u0107 sekwencj\u0119.",A(y,"","");return}if(r.textContent=u.name,i.textContent=Nt(u),s.innerHTML="",!u.audioTracks.length)s.appendChild(l("option",{value:"",text:"brak \u015Bcie\u017Cek audio"})),A(y,"Sekwencja nie zawiera \u015Bcie\u017Cek audio.","warn");else{for(let E of u.audioTracks){let U=[];E.muted&&U.push("wyciszona"),E.hasClips===!1&&U.push("brak klip\xF3w");let oe=U.length?`${E.name} (${U.join(", ")})`:E.name;s.appendChild(l("option",{value:String(E.index),text:oe}))}let h=u.audioTracks.find(E=>E.hasClips!==!1);s.value=String((h||u.audioTracks[0]).index),A(y,"","")}m.disabled=!u.hasInOut,u.hasInOut?(m.textContent=`Zakres In/Out (${Ct(u)})`,p.value="inout"):(m.textContent="Zakres In/Out (nie ustawiono)",p.value="full")}catch(u){r.textContent="\u2014",i.textContent="",s.innerHTML="",s.appendChild(l("option",{value:"",text:"\u2014"})),A(y,u.userMessage||"Nie uda\u0142o si\u0119 odczyta\u0107 sekwencji.","error"),Ye.warn("describeActiveSequence failed",{code:u&&u.code})}}o.addEventListener("click",ae),await ae();let K=null,z=null,Ee=null,O=null;function Se(u){j.disabled=u,$.disabled=!u,o.disabled=u,s.disabled=u,p.disabled=u,N.disabled=u}function be(u){B.disabled=!u,W.disabled=!u}function Ae(){return`${(r.textContent||"napisy").replace(/[^\p{L}\p{N}_-]+/gu,"_").slice(0,60)||"napisy"}.srt`}return j.addEventListener("click",async()=>{let u=F();if(!u.audioPresetPath){A(y,"Ustaw preset eksportu audio (.epr) w sekcji Ustawienia napis\xF3w.","warn");return}Se(!0),be(!1),M.disabled=!0,O=null,re(D,0),K=new AbortController;try{let{srtContent:h,cues:E}=await Ge({settings:u,selection:{audioTrackIndex:s.value===""?null:parseInt(s.value,10),range:p.value},signal:K.signal,onProgress:({percent:U,status:oe})=>{re(D,U),A(y,oe)}});z=h,Ee=E,re(D,100),A(y,`Gotowe: ${E.length} napis\xF3w.`,"ok"),be(!0)}catch(h){re(D,0);let E=h&&h.code===c.TRANSCRIPTION_CANCELLED;A(y,h&&h.userMessage||"Wyst\u0105pi\u0142 b\u0142\u0105d.",E?"warn":"error"),Ye.warn("Pipeline error",{code:h&&h.code})}finally{Se(!1),K=null}}),$.addEventListener("click",()=>{K&&(K.abort(),A(y,"Przerywanie\u2026","warn"))}),B.addEventListener("click",async()=>{if(!z)return;let u=F();try{let h=Ae(),E=u.exportFolder?await he(z,{dirNative:u.exportFolder,fileName:h}):await Xe(z,h);if(!E)return;O=E.path,M.disabled=!1,A(y,`Zapisano SRT: ${E.fileName}`,"ok")}catch(h){A(y,h&&h.userMessage||"Nie uda\u0142o si\u0119 zapisa\u0107 SRT.","error")}}),W.addEventListener("click",async()=>{if(z)try{O||(O=(await he(z,{fileName:Ae()})).path,M.disabled=!1);let u=await Qe(O);A(y,u.note||"Zaimportowano SRT do projektu.","ok")}catch(u){A(y,u&&u.userMessage||"Nie uda\u0142o si\u0119 utworzy\u0107 napis\xF3w. Zaimportuj SRT r\u0119cznie (File \u2192 Import).","warn")}}),M.addEventListener("click",async()=>{O&&await Ze(O)}),{generateBtn:j,cancelBtn:$,bar:D,status:y,exportSrtBtn:B,createCaptionsBtn:W,openFolderBtn:M,refreshSequence:ae,getSelection:()=>({audioTrackIndex:s.value===""?null:parseInt(s.value,10),range:p.value})}}function Nt(e){let t=[];return e.fps&&t.push(`${Math.round(e.fps*1e3)/1e3} fps`),t.push(`${e.audioTracks.length} \u015Bcie\u017Cek audio`),e.zeroPointSec>0&&t.push(`start ${ye(e.zeroPointSec)}`),t.join(" \xB7 ")}function Ct(e){return`${ye(e.inPointSec)} \u2013 ${ye(e.outPointSec)}`}function ye(e){let t=Math.max(0,Math.floor(e)),n=Math.floor(t/60),a=t%60;return`${n}:${String(a).padStart(2,"0")}`}function ne(e,t,n){let a=parseInt(e.value,10);return Number.isNaN(a)&&(a=t),a=Math.max(t,Math.min(n,a)),e.value=a,a}function A(e,t,n){e.textContent=t||"",e.className=`status${n?" "+n:""}`}function re(e,t){e.style.width=`${Math.max(0,Math.min(100,t))}%`}var et=`/* Polish Subtitle AI \u2014 ciemny motyw, styl narz\u0119dzia dla monta\u017Cysty. */

:root {
  --bg: #1e1e1e;
  --bg-elev: #2a2a2a;
  --bg-input: #333333;
  --border: #3d3d3d;
  --text: #e6e6e6;
  --text-dim: #9a9a9a;
  --accent: #4a8cff;
  --accent-hover: #5f9bff;
  --ok: #3ecf8e;
  --err: #ff5c5c;
  --warn: #ffb84a;
  --radius: 6px;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  font-size: 12px;
  height: 100%;
}

.app {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  min-height: 100%;
}

.title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  margin: 0;
}

.title .sub {
  display: block;
  font-size: 10px;
  font-weight: 400;
  color: var(--text-dim);
  margin-top: 2px;
}

.section {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.field label {
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field-row {
  display: flex;
  gap: 8px;
}
.field-row .field { flex: 1; }

.value {
  font-size: 12px;
  color: var(--text);
  font-weight: 500;
}

input[type="text"],
input[type="number"],
select {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 5px 7px;
  font-size: 12px;
  width: 100%;
}

input:focus, select:focus {
  outline: none;
  border-color: var(--accent);
}

.check {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text);
}

.btn {
  border: none;
  border-radius: var(--radius);
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: var(--bg-input);
  color: var(--text);
}
.btn:hover { background: #3c3c3c; }
.btn:disabled { opacity: 0.45; cursor: default; }

.btn-primary {
  background: var(--accent);
  color: #fff;
}
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }

.btn-danger { background: #4a2b2b; color: var(--err); }

.actions { display: flex; flex-direction: column; gap: 8px; }
.actions-row { display: flex; gap: 8px; }
.actions-row .btn { flex: 1; }

.progress {
  height: 8px;
  background: var(--bg-input);
  border-radius: 999px;
  overflow: hidden;
}
.progress > .bar {
  height: 100%;
  width: 0%;
  background: var(--accent);
  transition: width 0.2s ease;
}

.status {
  font-size: 11px;
  color: var(--text-dim);
  min-height: 14px;
}
.status.error { color: var(--err); }
.status.ok { color: var(--ok); }
.status.warn { color: var(--warn); }

.muted { color: var(--text-dim); font-size: 10px; }

.divider { height: 1px; background: var(--border); margin: 2px 0; }

details.settings summary {
  cursor: pointer;
  font-size: 11px;
  color: var(--text-dim);
  user-select: none;
}
details.settings[open] summary { color: var(--text); }
`;var vt=S("main");function _t(){try{let e=document.createElement("style");e.textContent=et,document.head.appendChild(e)}catch(e){console.error("Nie uda\u0142o si\u0119 wstrzykn\u0105\u0107 styl\xF3w",e)}}async function Mt(){let e=document.getElementById("app");e&&(_t(),await X(),Ne({devLogging:F().devLogging}),vt.info("Polish Subtitle AI \u2014 start panelu"),await Je(e))}Mt().catch(e=>{console.error("Boot error",e);let t=document.getElementById("app");t&&(t.innerHTML='<div class="app"><div class="section"><div class="status error">Nie uda\u0142o si\u0119 uruchomi\u0107 panelu. Sprawd\u017A logi.</div></div></div>')});})();
