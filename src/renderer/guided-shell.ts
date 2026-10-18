/** Primary navigation and compatibility routes for the guided workspace. */
export const guidedDestinations = [
  {id:'images',en:'Images',zh:'映像',icon:'album'},
  {id:'builds',en:'Builds',zh:'建置',icon:'build'},
  {id:'tools',en:'Tools',zh:'工具',icon:'construction'},
  {id:'help',en:'Help',zh:'說明',icon:'help_outline'},
  {id:'settings',en:'Settings',zh:'設定',icon:'settings'},
] as const;
export const operationDestinations = ['runtime','source','config','package','builds','artifacts','guests','tools','assistant','regex','authenticator','companion','updates','documentation'] as const;
export function primaryForOperation(tab:string) {
  if(tab==='builds')return 'builds';
  if(tab==='updates')return 'settings';
  if(tab==='documentation')return 'help';
  if(['tools','guests','assistant','regex','authenticator','companion'].includes(tab))return 'tools';
  return 'images';
}
export type GuidedOperations = {
  tab:string;
  openProjectWorkflow?:(mode:'create'|'open')=>Promise<void>|void;
};
