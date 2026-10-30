import {test,expect} from '@playwright/test';

test('regex handle-icon switch preserves owning search state and instance isolation',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    await customElements.whenDefined('settings-search');document.querySelector('material-buildroot')?.remove();
    for(const id of ['first-search','second-search']){
      const search=document.createElement('settings-search');search.id=id;search.language='en';
      search.entries=[{id:'alpha',text:'Alpha'},{id:'beta',text:'Beta'}];document.body.append(search);await search.updateComplete;
    }
  });
  const first=page.locator('#first-search'),second=page.locator('#second-search');
  await first.getByRole('textbox').fill('^Alpha$');
  await expect(first).toHaveJSProperty('count',0);
  await first.getByRole('switch',{name:'Use regular expression',exact:true}).check();
  await expect(first.locator('md-switch')).toHaveJSProperty('icons',true);
  await expect(first).toHaveJSProperty('regex',true);await expect(first).toHaveJSProperty('count',1);
  await expect(second).toHaveJSProperty('regex',false);await expect(second).toHaveJSProperty('query','');
  await first.getByRole('switch',{name:'Use regular expression',exact:true}).uncheck();
  await expect(first).toHaveJSProperty('query','^Alpha$');await expect(first).toHaveJSProperty('pattern','^Alpha$');
  await expect(first).toHaveJSProperty('flags','i');await expect(first).toHaveJSProperty('count',0);
  await first.getByRole('button',{name:'Open full regex workbench',exact:true}).click();
  await expect(first.locator('regex-workbench')).toBeVisible();
  await first.getByRole('button',{name:'Close workbench',exact:true}).click();
  await expect(first.getByRole('textbox')).toBeFocused();
});

test('notification icon resolves to the local bell instead of the build fallback',async({page})=>{
  await page.goto('/');
  const paths=await page.evaluate(async()=>{
    const {materialIcon}=await import('/src/renderer/material-icons.ts');
    const {render}=await import('/node_modules/lit-html/lit-html.js');
    const bell=document.createElement('div'),fallback=document.createElement('div');
    render(materialIcon('notifications'),bell);render(materialIcon('build'),fallback);
    return {bell:bell.querySelector('svg path')?.getAttribute('d'),fallback:[...fallback.querySelectorAll('svg path')].map(path=>path.getAttribute('d'))};
  });
  expect(paths.bell).toMatch(/^M12 22c1\.1/);expect(paths.fallback).not.toContain(paths.bell);
});

for(const edge of ['left','right','top','bottom']){
  test(`rendered drawer orientation follows breakpoint while preserving saved ${edge} docking`,async({page})=>{
    await page.setViewportSize({width:1181,height:900});await page.goto('/');
    await page.evaluate(async edge=>{
      await customElements.whenDefined('workspace-tabs');document.querySelector('material-buildroot')?.remove();
      localStorage.setItem('material-buildroot.workspace-tabs.v1',JSON.stringify({version:1,edge,tabs:[],groups:[],active:''}));
      const tabs=document.createElement('workspace-tabs');tabs.id='orientation-fixture';tabs.language='en';
      tabs.style.cssText='height:700px;width:100%;display:flex';
      tabs.destinations=['alpha','beta'].map(id=>({id,en:id,zh:id,icon:'folder_open'}));
      document.body.append(tabs);tabs.acknowledge('alpha','alpha');tabs.acknowledge('beta','beta');
      await tabs.updateComplete;
    },edge);
    const tabs=page.locator('#orientation-fixture'),first=tabs.locator('[role=tab]').nth(0),second=tabs.locator('[role=tab]').nth(1);
    for(const width of [1181,1180,1181]){
      await page.setViewportSize({width,height:900});
      const vertical=width===1180||['left','right'].includes(edge);
      await expect(tabs.locator('.pinned')).toHaveAttribute('aria-orientation',vertical?'vertical':'horizontal');
      await expect(tabs.locator('.strip')).toHaveAttribute('aria-orientation',vertical?'vertical':'horizontal');
      if(width===1180)await tabs.locator('[data-control=drawer-toggle]').click();
      await first.focus();await page.keyboard.press(vertical?'ArrowDown':'ArrowRight');await expect(second).toBeFocused();
      await page.keyboard.press(vertical?'ArrowUp':'ArrowLeft');await expect(first).toBeFocused();
      await expect(tabs).toHaveJSProperty('edge',edge);
      expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.workspace-tabs.v1')).edge)).toBe(edge);
    }
  });
}

for(const language of ['en','zh-HK','bilingual'])for(const width of [1440,960]){
  test(`header search has bounded geometry and keyboard focus at ${width} in ${language}`,async({page})=>{
    await page.setViewportSize({width,height:width===1440?960:640});
    await page.goto('/');
    await page.locator('material-buildroot').evaluate(async(element,language)=>{
      await element.updateComplete;
      element.state={...element.state,language};element.scheduleSnapshot=null;element.restricted=false;
      element.requestUpdate();await element.updateComplete;await document.fonts.ready;
    },language);
    const search=page.locator('material-buildroot .command-search');
    const geometry=await search.evaluate(element=>{
      const bounds=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
      return {host:bounds(element),header:bounds(element.closest('header')),icon:bounds(element.querySelector('md-icon')),touch:bounds(element.shadowRoot.querySelector('.touch')),label:getComputedStyle(element.querySelector('.palette-label')).display,aria:element.getAttribute('aria-label'),title:element.title};
    });
    expect(geometry.header.height).toBe(64);
    expect(geometry.host.height).toBe(width===1440?48:44);
    expect(geometry.host.width).toBeGreaterThanOrEqual(44);
    for(const part of [geometry.host,geometry.touch]){
      expect(part.y).toBeGreaterThanOrEqual(geometry.header.y);
      expect(part.bottom).toBeLessThanOrEqual(geometry.header.bottom);
    }
    expect(geometry.icon.x).toBeGreaterThanOrEqual(geometry.host.x);
    expect(geometry.icon.right).toBeLessThanOrEqual(geometry.host.right);
    expect(geometry.icon.y).toBeGreaterThanOrEqual(geometry.host.y);
    expect(geometry.icon.bottom).toBeLessThanOrEqual(geometry.host.bottom);
    expect(geometry.label).toBe(width===960?'none':'flex');
    if(width===960)expect(geometry.host.width).toBe(44);
    expect(geometry.aria).toBeTruthy();expect(geometry.title).toBe(geometry.aria);
    expect(geometry.aria).toContain('Control Shift F');
    await search.focus();
    expect(await search.evaluate(element=>element.matches(':focus-within'))).toBe(true);
  });
}

// Browser component fixtures exercise presentation only, not native project authority.
test('medium shell keeps drawer, catalogue and docking access without rewriting saved edge',async({page})=>{
  await page.setViewportSize({width:960,height:640});
  await page.addInitScript(()=>localStorage.setItem('material-buildroot.workspace-tabs.v1',JSON.stringify({version:1,edge:'bottom',tabs:[],groups:[],active:''})));
  await page.goto('/');
  const tabs=page.locator('material-buildroot workspace-tabs');
  await expect(tabs).toHaveJSProperty('edge','bottom');
  await expect(tabs.locator('aside')).toBeHidden();
  await expect(tabs.locator('[data-control=compact-new-tab]')).toBeVisible();
  await expect(tabs.locator('[data-control=compact-manage-tabs]')).toBeVisible();
  await tabs.locator('[data-control=drawer-toggle]').click();
  await expect(tabs.locator('aside')).toBeVisible();
  await expect(tabs.locator('aside [data-control=new-tab]')).toBeFocused();
  await expect(tabs.locator('aside [data-control=tab-list]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tabs.locator('aside')).toBeHidden();
  await expect(tabs.locator('[data-control=drawer-toggle]')).toBeFocused();
  await expect(tabs).toHaveJSProperty('edge','bottom');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.workspace-tabs.v1')).edge)).toBe('bottom');
});

test('compact shell keeps bottom navigation, window actions, search and provenance reachable',async({page})=>{
  await page.setViewportSize({width:480,height:640});await page.goto('/');
  const shell=page.locator('material-buildroot');
  await expect(shell.locator('.shell>.body>nav')).toBeVisible();
  await expect(shell.locator('.command-search')).toBeVisible();
  await expect(shell.locator('.window md-text-button')).toHaveCount(3);
  for(const button of await shell.locator('.window md-text-button').all())await expect(button).toBeVisible();
  await expect(shell.locator('.front-provenance')).toBeVisible();
  const bounds=await shell.evaluate(element=>{
    const root=element.shadowRoot,nav=root.querySelector('.shell>.body>nav').getBoundingClientRect(),main=root.querySelector('workspace-tabs').getBoundingClientRect();
    return {navTop:nav.top,workspaceBottom:main.bottom,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  expect(bounds.navTop).toBeGreaterThanOrEqual(bounds.workspaceBottom);expect(bounds.overflow).toBe(false);
});

async function library(page){
  await page.goto('/');
  await page.evaluate(async()=>{
    await customElements.whenDefined('shell-image-library');
    document.querySelector('material-buildroot')?.remove();
    const library=document.createElement('shell-image-library');
    library.id='image-library-fixture';library.language='en';library.state='ready';
    library.rows=[{id:'alpha',name:'Alpha source',authorized:true},{id:'beta',name:'Beta source',authorized:false},{id:'gamma',name:'Gamma source',authorized:null}];
    library.openIds=['gamma'];window.imageRequests=[];
    library.addEventListener('image-library-open',event=>window.imageRequests.push(event.detail));
    document.body.append(library);await library.updateComplete;
  });
  return page.locator('#image-library-fixture');
}

test('catalogue access filters retain only actual host states and open requests',async({page})=>{
  const view=await library(page);
  await expect(view.locator('article')).toHaveCount(3);
  await view.getByRole('button',{name:'Needs access',exact:true}).click();
  await expect(view.locator('article')).toHaveCount(1);
  await expect(view.locator('article h3')).toHaveText('Beta source');
  await view.getByRole('button',{name:'Renew access',exact:true}).click();
  expect(await page.evaluate(()=>window.imageRequests)).toEqual([{id:'beta',renew:true}]);
  await view.getByRole('button',{name:'Open workspaces',exact:true}).click();
  await expect(view.locator('article h3')).toHaveText('Gamma source');
  await view.getByRole('button',{name:'Folder access saved',exact:true}).click();
  await expect(view.locator('article h3')).toHaveText('Alpha source');
});

test('selection survives filtering but catalogue refresh removes absent identities',async({page})=>{
  const view=await library(page);
  await view.getByRole('checkbox',{name:'Select project Alpha source',exact:true}).check();
  await view.getByRole('checkbox',{name:'Select project Beta source',exact:true}).check();
  await view.getByRole('button',{name:'Needs access',exact:true}).click();
  await expect(view.locator('.selection [role=status]')).toHaveText('2 selected');
  await view.evaluate(async element=>{element.rows=element.rows.filter(row=>row.id!=='alpha');await element.updateComplete;});
  await expect(view.locator('.selection [role=status]')).toHaveText('1 selected');
  await view.getByRole('button',{name:'Clear selection',exact:true}).click();
  await expect(view.getByRole('button',{name:'Export selected catalogue',exact:true})).toBeDisabled();
});

test('catalogue search uses its own full workbench and real bounded filtering',async({page})=>{
  const view=await library(page),search=view.locator('settings-search');
  await search.getByRole('textbox',{name:'Search image projects',exact:true}).fill('Beta');
  await expect(view.locator('article h3')).toHaveText('Beta source');
  await search.getByRole('button',{name:'Open full regex workbench',exact:true}).click();
  await expect(search.locator('regex-workbench')).toBeVisible();
  await search.evaluate(async element=>{element.query='^(Alpha|Gamma)';element.pattern=element.query;element.regex=true;await element.updateComplete;});
  await expect(view.locator('article')).toHaveCount(2);
  await search.evaluate(async element=>{element.query='[';element.pattern='[';await element.updateComplete;});
  await expect(view.locator('article')).toHaveCount(0);
  await expect(search.locator('p[role=status]')).toContainText('invalid');
});

test('dock search cannot substitute its query for a destructive close preview',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    await customElements.whenDefined('workspace-tabs');
    document.querySelector('material-buildroot')?.remove();
    localStorage.removeItem('material-buildroot.workspace-tabs.v1');
    const tabs=document.createElement('workspace-tabs');tabs.id='dock-fixture';tabs.language='en';
    tabs.destinations=[{id:'alpha',en:'Alpha',zh:'甲',icon:'folder_open'},{id:'beta',en:'Beta',zh:'乙',icon:'folder_open'}];
    document.body.append(tabs);tabs.acknowledge('alpha','Alpha');tabs.acknowledge('beta','Beta');
    window.closeVotes=0;tabs.addEventListener('workspace-close',()=>window.closeVotes++);
  });
  const tabs=page.locator('#dock-fixture');
  await tabs.getByRole('button',{name:'Search open tabs',exact:true}).click();
  await tabs.locator('.strip-search settings-search').getByRole('textbox').fill('Alpha');
  await expect(tabs.locator('[role=tab]')).toHaveCount(1);
  await tabs.locator('[data-control=tab-list]').click();
  await tabs.locator('[data-experience-id=workspace-close-matching]').click();
  await expect(tabs.getByRole('button',{name:'Confirm close previewed tabs',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>window.closeVotes)).toBe(0);
  await tabs.locator('md-dialog settings-search').first().getByRole('textbox').fill('Beta');
  await tabs.locator('[data-experience-id=workspace-close-matching]').click();
  await expect(tabs.getByRole('button',{name:'Confirm close previewed tabs',exact:true})).toBeVisible();
  await expect(tabs.locator('md-dialog section ul')).toHaveText('Beta');
});

test('existing saved docking wins over the new-install left default',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    await customElements.whenDefined('workspace-tabs');document.querySelector('material-buildroot')?.remove();
    localStorage.setItem('material-buildroot.workspace-tabs.v1',JSON.stringify({version:1,edge:'bottom',tabs:[],groups:[],active:''}));
    const saved=document.createElement('workspace-tabs');document.body.append(saved);await saved.updateComplete;
    const restored=saved.edge;saved.remove();localStorage.removeItem('material-buildroot.workspace-tabs.v1');
    const fresh=document.createElement('workspace-tabs');document.body.append(fresh);await fresh.updateComplete;
    return {restored,fresh:fresh.edge};
  });
  expect(result).toEqual({restored:'bottom',fresh:'left'});
});

for(const storage of ['fresh','saved','unavailable']){
  test(`real shell startup respects ${storage} docking state`,async({page})=>{
    await page.addInitScript(storage=>{
      const key='material-buildroot.workspace-tabs.v1';
      localStorage.removeItem(key);
      if(storage==='saved')localStorage.setItem(key,JSON.stringify({version:1,edge:'bottom',tabs:[],groups:[],active:''}));
      if(storage==='unavailable'){
        const read=Storage.prototype.getItem;
        Storage.prototype.getItem=function(name){if(name===key)throw new DOMException('Fixture storage unavailable','SecurityError');return read.call(this,name);};
      }
    },storage);
    await page.goto('/');
    const shell=page.locator('material-buildroot');
    await shell.evaluate(async element=>{await element.updateComplete;await element.shadowRoot.querySelector('workspace-tabs').updateComplete;});
    await expect(shell.locator('workspace-tabs')).toHaveJSProperty('edge',storage==='saved'?'bottom':'left');
  });
}

test('filtered dock offers one keyboard entry without activating a different workspace',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    await customElements.whenDefined('workspace-tabs');document.querySelector('material-buildroot')?.remove();
    localStorage.removeItem('material-buildroot.workspace-tabs.v1');
    const tabs=document.createElement('workspace-tabs');tabs.id='keyboard-dock';tabs.language='en';
    tabs.destinations=['alpha','beta','gamma','delta'].map(id=>({id,en:id,zh:id,icon:'folder_open'}));
    document.body.append(tabs);
    for(const id of ['alpha','beta','gamma','delta'])tabs.acknowledge(id,id);
    tabs.groups=[{id:'closed',name:'Closed group',collapsed:true}];
    tabs.tabs=tabs.tabs.map(tab=>({...tab,pinned:tab.destination==='beta',group:tab.destination==='gamma'?'closed':''}));
    tabs.active='utility::alpha';window.keyboardRequests=[];
    tabs.addEventListener('workspace-destination',event=>window.keyboardRequests.push(event.detail.destination));
    await tabs.updateComplete;
  });
  const tabs=page.locator('#keyboard-dock');
  await tabs.getByRole('button',{name:'Search open tabs',exact:true}).click();
  const query=tabs.locator('.strip-search settings-search').getByRole('textbox');
  await query.fill('beta');
  await expect(tabs.locator('[role=tab]')).toHaveCount(1);
  await expect(tabs.locator('[role=tab][tabindex="0"]')).toHaveAttribute('data-tab-id','utility::beta');
  for(let i=0;i<10;i++){
    await page.keyboard.press('Tab');
    if(await tabs.locator('[role=tab]').evaluate(element=>element===element.getRootNode().activeElement))break;
  }
  await expect(tabs.locator('[role=tab]')).toBeFocused();
  expect(await tabs.evaluate(element=>element.active)).toBe('utility::alpha');
  expect(await page.evaluate(()=>window.keyboardRequests)).toEqual([]);
  await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>window.keyboardRequests)).toEqual(['beta']);
  // A collapsed group is not a candidate for the fallback keyboard entry.
  await query.fill('gamma');
  await expect(tabs.locator('[role=tab]')).toHaveCount(0);
  await query.fill('');
  await expect(tabs.locator('[role=tab][tabindex="0"]')).toHaveAttribute('data-tab-id','utility::alpha');
  await tabs.evaluate(async element=>{element.active='utility::gamma';await element.updateComplete;});
  await expect(tabs.locator('[role=tab][tabindex="0"]')).toHaveAttribute('data-tab-id','utility::beta');
  expect(await tabs.evaluate(element=>element.active)).toBe('utility::gamma');
});
