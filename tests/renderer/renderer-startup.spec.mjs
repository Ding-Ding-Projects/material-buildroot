import {test,expect} from '@playwright/test';

test('startup registers workspace navigation without replacing native element methods',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 const tabs=page.locator('workspace-tabs');
 await expect(tabs).toHaveCount(1);
 await expect.poll(()=>tabs.evaluate(element=>({
  registered:element instanceof customElements.get('workspace-tabs'),
  acknowledge:typeof element.acknowledge,
  matches:typeof element.matches,
 }))).toEqual({registered:true,acknowledge:'function',matches:'function'});
 expect(await tabs.evaluate(element=>element.matches('workspace-tabs'))).toBe(true);
 expect(errors).toEqual([]);
});
