export function parseRoadmap(roadmap) {
  const normalized = roadmap.replace(/\r\n?/g, '\n');
return [...normalized.matchAll(/^## (PH\d+) (.+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].map(match=>{
  const tasks = [...match[3].matchAll(/^- \[([ x])\] \*\*(PH\d+-T\d+(?:-\d+)?)\*\* (.+)$/gm)].map(m=>({id:m[2],done:m[1]==='x',text:m[3]}));
  const done=tasks.filter(t=>t.done).length;
  return {id:match[1],title:match[2],body:match[3],tasks,done,status:done===tasks.length?'complete':done?'started':'planned'};
});
}
