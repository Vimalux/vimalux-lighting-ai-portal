// Local real-React integration tests. Supabase is intercepted; external HTTP is blocked.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.VIMALUX_PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.VIMALUX_TEST_ORIGIN || "http://127.0.0.1:4175";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw Error("Local test server required");
const out = process.env.VIMALUX_TEST_OUTPUT || "../../browser-context-results.json";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];
const FELETTO = "11111111-1111-4111-8111-111111111111", PROMOTED = "22222222-2222-4222-8222-222222222222";
const mock = `
import { defaultProject } from "/src/model.js";
const config = window.__fixture || {};
const p = defaultProject(); p.id = "11111111-1111-4111-8111-111111111111"; p.project.name = "Feletto"; p.customer.name = "Feletto"; p.language = "en"; p.project.businessCaseId = "BC-FELETTO"; p.groups[0].quantity=11;
const session = { user: { id: "test-user", email: "test@example.invalid" } };
const listeners = new Set();
let saved = JSON.parse(sessionStorage.getItem("test-cloud") || "null") || [p];
const t = window.__contextTest = { cloudLoads:0, saves:[], profile:{id:"test-user",role:config.role||"admin"}, pending:[] };
t.refresh = () => listeners.forEach(fn=>fn("TOKEN_REFRESHED", {...session}));
t.signOut = () => listeners.forEach(fn=>fn("SIGNED_OUT",null));
t.release = () => t.pending.splice(0).forEach(fn=>fn(structuredClone(p)));
export const stagingPreview = false;
export const supabaseConfigured = true;
export const supabase = {
 auth: { getSession:async()=>({data:{session}}),getUser:async()=>({data:{user:session.user}}),
 onAuthStateChange:fn=>{listeners.add(fn);return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}}},
 signOut:async()=>t.signOut() },
 from:()=>({insert:async()=>({error:null})}),
 rpc:async()=>({data:[],error:null})
};
export const loadCurrentProfile = async()=>t.profile;
export async function loadCloudState(locals) { t.cloudLoads++; return config.late ? [] : [...saved,...locals.filter(x=>!saved.some(y=>x.id===y.id))]; }
export const loadStagingCatalogue = async()=>p.catalogue;
export async function loadBusinessCase() { return config.late ? new Promise(r=>t.pending.push(r)) : p; }
export async function saveCloudState(projects) {
 t.saves.push(structuredClone(projects));
 const promotions=[];
 saved=structuredClone(projects).map(x=>{
  if(config.promote && x.id !== "11111111-1111-4111-8111-111111111111" && x.id !== "22222222-2222-4222-8222-222222222222") {
   promotions.push({legacyId:x.id,caseId:"22222222-2222-4222-8222-222222222222"}); x.id="22222222-2222-4222-8222-222222222222";x.crm.businessCaseRecordId=x.id;
  } return x;
 });
 sessionStorage.setItem("test-cloud",JSON.stringify(saved));
 return promotions;
}
export const deleteCloudProject=async()=>{};
export const createOrOpenBusinessCase=async()=>({caseId:p.id});
export const getLinkedBusinessCaseId=async()=>p.id;
export const publishPreliminaryProposal=async()=>({});
`;
async function setup(config={}) {
 const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
 const blocked=[], errors=[];
 await context.addInitScript(config=>{window.__fixture=config;},config);
 await context.route("**/*",async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==origin) {blocked.push(url.origin+url.pathname);return route.abort();}
  if(url.pathname==="/src/supabase.js") return route.fulfill({contentType:"application/javascript",body:mock});
  return route.continue();
 });
 const page=await context.newPage();
 page.on("pageerror",error=>errors.push(error.message));
 await page.goto(origin+(config.late?"?business_case_id="+FELETTO:""));
 await page.waitForSelector(".app");
 return {context,page,blocked,errors};
}
async function active(page) {return page.locator(".app").getAttribute("data-active-project-id");}
async function openProjects(page) {await page.locator("aside").getByRole("button",{name:/^(Projects|Progetti)$/}).click();}
async function newSan(page) {
 await openProjects(page);
 await page.getByRole("button",{name:/New project|Nuovo progetto/}).click();
 await page.getByLabel("Language",{exact:true}).selectOption("en");
 await page.getByRole("textbox",{name:"Project name",exact:true}).fill("San Fele");
 await page.getByRole("textbox",{name:/Municipality|Comune \/ cliente/}).fill("San Fele");
 return active(page);
}
async function check(name,fn) {await fn();results.push({name,status:"PASS"});console.log("PASS",name);}
try {
 await check("San Fele creation, existing lighting, token refresh, reload, back/forward and critical views",async()=>{
  const {context,page,blocked,errors}=await setup();
  const id=await newSan(page);
  await page.locator('[data-intelligence-view="existing"]').click();
  await page.locator("tbody tr td:nth-child(2) input").first().fill("22");
  await page.locator("main > header").click();
  await page.waitForTimeout(1100);
  assert.equal(await active(page),id);
  assert.match(await page.locator("main > header small").textContent(),/San Fele/);
  assert.equal(new URL(page.url()).searchParams.get("business_case_id"),id);
  const loads=await page.evaluate(()=>window.__contextTest.cloudLoads);
  await page.evaluate(()=>window.__contextTest.refresh());
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.__contextTest.cloudLoads),loads);
  assert.equal(await active(page),id);
  await page.reload();await page.waitForSelector(".app");
  assert.equal(await active(page),id);
  assert.match(await page.locator("aside nav button.active").textContent(),/Existing Lighting/);
  assert.equal(await page.locator("tbody tr td:nth-child(2) input").first().inputValue(),"22");
  const groups=await page.evaluate(()=>JSON.parse(localStorage.getItem("vimalux-intelligence-projects")).map(p=>[p.customer.name,p.groups[0].quantity]));
  assert.equal(groups.find(p=>p[0]==="Feletto")[1],11);
  assert.equal(groups.find(p=>p[0]==="San Fele")[1],22);
  for(const view of ["solution","additionalCosts","assumptions","business","report","orderList","customer","existing"]) {
   await page.locator('[data-intelligence-view="'+view+'"]').click();
   assert.equal(await active(page),id);
  }
  await openProjects(page);
  await page.locator(".project-select").filter({hasText:"Feletto"}).click();
  assert.equal(await active(page),FELETTO);
  await page.goBack();await page.waitForTimeout(100);
  assert.equal(await active(page),id);
  await page.goForward();await page.waitForTimeout(100);
  assert.equal(await active(page),FELETTO);
  await openProjects(page);
  await page.locator(".project-select").filter({hasText:"San Fele"}).click();
  assert.match(await page.locator("aside nav button.active").textContent(),/Customer/);
  const other=await context.newPage();
  await other.goto(origin+"?business_case_id="+FELETTO);
  await other.waitForSelector(".app");
  assert.equal(await active(other),FELETTO);
  await other.locator('[data-intelligence-view="existing"]').click();
  await page.bringToFront();
  await page.evaluate(()=>{window.dispatchEvent(new Event("focus"));document.dispatchEvent(new Event("visibilitychange"));});
  assert.equal(await active(page),id);
  assert.match(await page.locator("main > header small").textContent(),/San Fele/);
  assert.deepEqual(errors,[]);
  assert.equal(blocked.filter(x=>x.includes("ymzdjjpvuvhxxzsffqik")||x.includes("app.vimalux.com")).length,0);
  await context.close();
 });
 await check("Delayed Feletto response cannot replace San Fele",async()=>{
  const {context,page,errors}=await setup({late:true});
  await page.waitForFunction(()=>window.__contextTest.pending.length>0);
  const id=await newSan(page);
  await page.locator('[data-intelligence-view="existing"]').click();
  await page.evaluate(()=>window.__contextTest.release());
  await page.waitForTimeout(100);
  assert.equal(await active(page),id);
  assert.match(await page.locator("main > header small").textContent(),/San Fele/);
  assert.deepEqual(errors,[]);
  await context.close();
 });
 await check("Cloud ID promotion retains Existing Lighting and matching URL/header",async()=>{
  const {context,page,errors}=await setup({promote:true});
  await newSan(page);
  await page.locator('[data-intelligence-view="existing"]').click();
  await page.waitForFunction(id=>document.querySelector(".app")?.dataset.activeProjectId===id,PROMOTED);
  assert.match(await page.locator("aside nav button.active").textContent(),/Existing Lighting/);
  assert.equal(new URL(page.url()).searchParams.get("business_case_id"),PROMOTED);
  assert.match(await page.locator("main > header small").textContent(),/San Fele/);
  assert.deepEqual(errors,[]);
  await context.close();
 });
 await check("Agent keeps workflow access without creation, deletion or price administration",async()=>{
  const {context,page,errors}=await setup({role:"agent"});
  await page.locator('[data-intelligence-view="existing"]').click();
  await openProjects(page);
  assert.equal(await page.locator(".project-delete").count(),0);
  assert.equal(await page.getByRole("button",{name:/New project|Nuovo progetto/}).count(),0);
  assert.equal(await page.locator("aside").getByRole("button",{name:/Price Administration/}).count(),0);
  assert.deepEqual(errors,[]);
  await context.close();
 });
} catch(error) {results.push({status:"FAIL",error:error.stack});process.exitCode=1;console.error(error);}
finally {await browser.close();await fs.writeFile(out,JSON.stringify(results,null,2));}
