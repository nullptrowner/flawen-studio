import { chromium } from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const out=new URL('../pictures/',import.meta.url).pathname;
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1600,height:1000}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5180');await page.getByText('Saved locally',{exact:true}).waitFor();
await page.getByLabel('Template language').selectOption('ru');
const items=[
 ['15-session-finish','Session start','СЕССИЯ\nЗАВЕРШЕНА','Спасибо за работу. Фиксируем результат.'],
 ['16-offer-results','Session results','РЕЗУЛЬТАТЫ\nОФФЕРА','5 минут на результаты и подготовку.'],
 ['17-offer-generic','Offer 01','ОФФЕР','']
];
async function json(){const pending=page.waitForEvent('download');await page.getByTitle('Export editable JSON').click();const file=await pending;return JSON.parse(await readFile(await file.path(),'utf8'));}
async function edit(name,value,size){await page.getByRole('button',{name:'Layers',exact:true}).click();const button=page.locator('.layer-name').filter({hasText:new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).first();if(!await button.count())return;await button.click();await page.getByLabel('Text content',{exact:true}).fill(value);if(size)await page.getByLabel('Font size',{exact:true}).fill(String(size));}
async function exportFile(stem,format='png'){await page.getByRole('button',{name:'Export ↗',exact:true}).click();await page.getByLabel('Format',{exact:true}).selectOption(format);const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download artwork',exact:true}).click();await(await pending).saveAs(out+stem+'.'+format);await page.getByRole('button',{name:'Close dialog'}).click();}
const manifest=[];
for(const [stem,template,title,body] of items){
 await page.getByRole('button',{name:'Templates',exact:true}).click();
 const candidate=page.getByRole('button',{name:'Use '+template,exact:true});
 if(!await candidate.count()){console.log('Available',await page.locator('.template-card button').allTextContents());throw Error('Missing template '+template)}
 await candidate.click();
 await page.getByRole('button',{name:'Project settings',exact:true}).click();
 await page.getByLabel('Project name',{exact:true}).fill('FLAWEN / '+stem);
 await page.getByRole('button',{name:'Apply settings',exact:true}).click();
 let scene=await json();
 if(title){const l=scene.layers.find(l=>l.name==='Headline');const lines=title.split('\n');const size=Math.floor(Math.min(136,l.width/(Math.max(...lines.map(s=>s.length))*.77),(l.height-8)/(lines.length*l.lineHeight)));await edit('Headline',title,size);}
 if(body)await edit('Body',body,21);
 await edit('Subtitle', stem==='15-session-finish'?'Рабочий цикл завершён':stem==='16-offer-results'?'Результаты и подготовка':'МЕДИАБАИНГ / FLAWEN',20);
 scene=await json();
 const removals=scene.layers.map((l,i)=>({l,i})).filter(({l})=>(l.kind==='text'&&(!l.text||/^(Date|Time|Session name|Session ID|Session number|Start time|Result)( label)?$/.test(l.name)))||(l.kind==='line'&&l.x>=950&&l.y<630));
 await page.getByRole('button',{name:'Layers',exact:true}).click();
 for(const {i} of removals.sort((a,b)=>a.i-b.i)){await page.locator('.layer-name').nth(scene.layers.length-1-i).click();await page.getByTitle('Delete selected layers',{exact:true}).click();}
 await page.getByRole('button',{name:'Backgrounds',exact:true}).click();await page.getByRole('button',{name:'Edit surface properties ↗'}).click();
 await page.getByRole('button',{name:'MICRO-WEAR',exact:true}).click();
 await page.getByRole('button',{name:'Save project',exact:true}).click();await page.getByText('Saved locally',{exact:true}).waitFor();
 scene=await json();await writeFile(out+'projects/'+stem+'.json',JSON.stringify(scene,null,2));await exportFile(stem);
 const bytes=await readFile(out+stem+'.png');if(bytes.readUInt32BE(16)!==scene.width||bytes.readUInt32BE(20)!==scene.height)throw Error('Wrong dimensions');
 manifest.push({file:stem+'.png',width:scene.width,height:scene.height,title:title??stem});console.log('EXPORTED',stem,scene.width,scene.height);
}
await writeFile(out+'sessions-bot-manifest.json',JSON.stringify({createdIn:'FLAWEN STUDIO browser interface',images:manifest,errors},null,2));await context.close();await browser.close();if(errors.length)throw Error(errors.join('\n'));
