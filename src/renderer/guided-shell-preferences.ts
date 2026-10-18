export type ShellDensity='comfortable'|'compact';
export const shellPreferenceKey='material-buildroot.guided-shell.v1';
export function readShellDensity():{density:ShellDensity;available:boolean}{
  try{
    const raw=localStorage.getItem(shellPreferenceKey);
    if(raw===null)return {density:'comfortable',available:true};
    if(raw.length>128)throw new Error('Invalid shell preference');
    const value:unknown=JSON.parse(raw);
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid shell preference');
    const record=value as Record<string,unknown>;
    if(record.version!==1||(record.density!=='comfortable'&&record.density!=='compact')||Object.keys(record).some(key=>!['version','density'].includes(key)))throw new Error('Invalid shell preference');
    return {density:record.density as ShellDensity,available:true};
  }catch{return {density:'comfortable',available:false};}
}
export function saveShellDensity(density:ShellDensity):boolean{
  if(density!=='comfortable'&&density!=='compact')return false;
  try{localStorage.setItem(shellPreferenceKey,JSON.stringify({version:1,density}));return true;}catch{return false;}
}
