/* eslint-disable -- one-off sync script (records exactly what was applied on 2026-11-19) */
// Applies the catalog sync to the TEST database. DRY=1 prints only.
const fs=require("fs"),path=require("path"),crypto=require("crypto");const REPO="P:/Codex/imperio-sofas-staging";
const {createClient}=require(path.join(REPO,"node_modules/@supabase/supabase-js"));const sharp=require(path.join(REPO,"node_modules/sharp"));
const env={};for(const l of fs.readFileSync(path.join(REPO,".env.local"),"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim();}
if(!env.NEXT_PUBLIC_SUPABASE_URL.includes("qsafyqsskwbjnailgoev"))throw new Error("not TEST");
const s=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const DRY=process.env.DRY==="1";const log=[];const L=(...a)=>{const t=a.join(" ");log.push(t);console.log(t);};
const plan=JSON.parse(fs.readFileSync("plan.json"));const site=JSON.parse(fs.readFileSync("site-full.json"));const images=JSON.parse(fs.readFileSync("images.json"));
const SUPPLIER="22d93cc6-41ca-4f11-8e38-34552aa61a85";
const norm=t=>t.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const slugify=t=>norm(t).replace(/ /g,"-");
const mm=l=>{const m=(l||"").match(/(\d)[.,](\d{2})\s?m?$/);return m?Number(m[1])*1000+Number(m[2])*10:null;};
(async()=>{
 // 1. price updates (skip Sheik: widths are not numeric, site equals DB)
 const ups=plan.updates.filter(u=>u.name!=="Mesa Sheik"&&u.name!=="Sofá Belize");
 for(const u of ups){L("PRICE",u.name,u.sku,u.from/100,"->",u.to/100);if(!DRY){const r=await s.from("product_variants").update({price_cents:u.to,updated_at:new Date().toISOString()}).eq("id",u.variant);if(r.error)throw r.error;}}
 // 2. Belize: variant 3,69 m no longer exists on the site; site has 2,60 m
 {const {data:p}=await s.from("products").select("id,product_variants(id,sku,width_mm,price_cents,attributes)").eq("slug","sofas-sofa-belize").single();
  const x=site.find(v=>v.name==="Sofá Belize");const byW=new Map(p.product_variants.map(v=>[v.width_mm,v]));
  for(const m of x.measures){const w=mm(m.label);const v=byW.get(w)||byW.get(3690);if(!v)continue;
   const patch={price_cents:m.price};if(v.width_mm===3690){patch.width_mm=2600;patch.sku="IMP-SOF-SOFABELIZE-260";patch.attributes={...v.attributes,source_variant_label:"2,60 m",source_variant_width_label:"2,60 m",source_variant_width_mm:2600};}
   if(v.price_cents!==patch.price_cents||patch.width_mm){L("BELIZE",v.sku,v.width_mm,v.price_cents/100,"->",patch.width_mm||v.width_mm,m.price/100);if(!DRY){const r=await s.from("product_variants").update(patch).eq("id",v.id);if(r.error)throw r.error;}}}}
 // 2b. Vero: site now lists 2,50 m (DB had 2,30 m)
 {const {data:p}=await s.from("products").select("id,product_variants(id,sku,width_mm,attributes)").eq("slug","sofas-sofa-vero").single();const v=p.product_variants[0];
  if(v.width_mm===2300){L("VERO width 2300 -> 2500");if(!DRY){const r=await s.from("product_variants").update({width_mm:2500,sku:"IMP-SOF-SOFAVERO-250",attributes:{...v.attributes,source_variant_label:"2,50 m",source_variant_width_label:"2,50 m",source_variant_width_mm:2500}}).eq("id",v.id);if(r.error)throw r.error;}}}
 // 3. Havena: site now sells only 1.20x0.80; DB has an extra variant
 {const {data:p}=await s.from("products").select("id,product_variants(id,sku,price_cents,is_active,attributes)").eq("slug","mesa-havena").single();
  for(const v of p.product_variants)L("HAVENA-VARIANT",v.sku,v.price_cents/100,v.is_active,JSON.stringify(v.attributes.source_variant_label||v.attributes.source_dimensions||"").slice(0,100));
  const extra=p.product_variants.find(v=>v.price_cents===149900);
  if(extra&&extra.is_active){L("HAVENA deactivate",extra.sku);if(!DRY){const r=await s.from("product_variants").update({is_active:false}).eq("id",extra.id);if(r.error)throw r.error;}}}
 // 4. Hide products no longer on the site (draft, nothing deleted)
 {const {data:p}=await s.from("products").select("slug,status").eq("slug","colchoes-colchao-casal-privilege").single();
  if(p&&p.status==="active"){L("HIDE colchoes-colchao-casal-privilege (removed from site)");if(!DRY){const r=await s.from("products").update({status:"draft"}).eq("slug",p.slug);if(r.error)throw r.error;}}}
 // 5. category
 let {data:kc}=await s.from("categories").select("id").eq("slug","kit-cozinha").maybeSingle();
 if(!kc){L("CATEGORY kit-cozinha");if(!DRY){const r=await s.from("categories").insert({name:"Kit Cozinha",slug:"kit-cozinha",description:"Kits de cozinha",position:7,is_active:true}).select("id").single();if(r.error)throw r.error;kc=r.data;}else kc={id:"dry"};}
 const {data:sc}=await s.from("categories").select("id,slug");const catId=Object.fromEntries(sc.map(c=>[c.slug,c.id]));if(kc&&kc.id)catId["kit-cozinha"]=kc.id;
 // 6. new products as DRAFT with zero stock
 for(const name of plan.newProducts){const x=site.find(v=>v.name===name);const cat=x.cat;
  const slug=(cat==="kit-cozinha"?"":cat+"-")+slugify(name);const {data:ex}=await s.from("products").select("id").eq("slug",slug).maybeSingle();if(ex){L("EXISTS",slug);continue;}
  const pid=crypto.randomUUID();const prefix=(cat==="sofas"?"SOF":"KIT");const base=slugify(name).replace(/-/g,"").toUpperCase();
  const vars=x.measures.map(m=>{let w=mm(m.label);if(w===null){const sp=(x.spec||[]).map(t=>t.match(/Comprimento\s+(\d)[.,](\d{2})/)).find(Boolean);w=sp?Number(sp[1])*1000+Number(sp[2])*10:null;}return {w,price:m.price,label:m.label};});
  L("NEW",slug,"cat="+cat,"variants="+vars.map(v=>`${v.w}:${v.price/100}`).join(","),"images="+(images[name]?.urls.length||0));
  if(DRY)continue;
  const r=await s.from("products").insert({id:pid,category_id:catId[cat],name,slug,description:x.desc||name,status:"draft",supplier_id:SUPPLIER,free_shipping:false});if(r.error)throw r.error;
  for(const v of vars){const vid=crypto.randomUUID();const sku=`IMP-${prefix}-${base}-${v.w?Math.round(v.w/10):"UNI"}`;
   const attrs={sku_origin:"generated",origin:"catalog_scan_2026-11-19",source_variant_label:v.label,source_colors:x.colors,source_fabrics:x.fabrics,source_features:x.feats,source_dimensions:x.spec,pickup_only:x.pickupOnly};
   let r2=await s.from("product_variants").insert({id:vid,product_id:pid,sku,width_mm:v.w,price_cents:v.price,is_active:true,attributes:attrs});if(r2.error)throw r2.error;
   r2=await s.from("inventory").upsert({variant_id:vid,on_hand:0,reserved:0,low_stock_threshold:5});if(r2.error)throw r2.error;}
  let pos=0;for(const url of images[name]?.urls||[]){const buf=Buffer.from(await (await fetch(url)).arrayBuffer());
   const webp=await sharp(buf,{limitInputPixels:100_000_000}).rotate().resize({width:2400,height:2400,fit:"inside",withoutEnlargement:true}).webp({quality:84}).toBuffer();
   const iid=crypto.randomUUID();const sp=`products/${pid}/${iid}.webp`;const up=await s.storage.from("catalog-images").upload(sp,webp,{contentType:"image/webp",upsert:false});if(up.error)throw up.error;
   const rm=await s.from("product_media").insert({product_id:pid,media_type:"image",storage_path:sp,alt_text:name,position:pos,attributes:{is_primary:pos===0,source_url:url}});if(rm.error)throw rm.error;pos++;}
  L("  created",pid,"media",pos);}
 fs.writeFileSync(DRY?"apply-dry.log":"apply.log",log.join("\n"));console.log(DRY?"DRY RUN done":"APPLIED");
})().catch(e=>{console.error("FAILED",e.message||e);process.exit(1);});
