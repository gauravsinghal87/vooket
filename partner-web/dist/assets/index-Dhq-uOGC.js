var Os=Object.defineProperty;var Ms=(e,t,r)=>t in e?Os(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r;var jt=(e,t,r)=>Ms(e,typeof t!="symbol"?t+"":t,r);import{Q as $s,j as n,u as te,a as G,b as de,c as Fs}from"./query-C-0bToFF.js";import{a as Ls,R as _t,u as gr,r as p,N as br,O as en,b as it,L as ot,c as Bs,d as qs,e as Vs,f as ne,B as Hs}from"./router-BOt24wyu.js";(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))s(a);new MutationObserver(a=>{for(const i of a)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function r(a){const i={};return a.integrity&&(i.integrity=a.integrity),a.referrerPolicy&&(i.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?i.credentials="include":a.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(a){if(a.ep)return;a.ep=!0;const i=r(a);fetch(a.href,i)}})();var yr,In=Ls;yr=In.createRoot,In.hydrateRoot;const Tn=e=>{let t;const r=new Set,s=(l,h)=>{const m=typeof l=="function"?l(t):l;if(!Object.is(m,t)){const u=t;t=h??(typeof m!="object"||m===null)?m:Object.assign({},t,m),r.forEach(f=>f(t,u))}},a=()=>t,c={setState:s,getState:a,getInitialState:()=>d,subscribe:l=>(r.add(l),()=>r.delete(l))},d=t=e(s,a,c);return c},Ks=e=>e?Tn(e):Tn,zs=e=>e;function Us(e,t=zs){const r=_t.useSyncExternalStore(e.subscribe,_t.useCallback(()=>t(e.getState()),[e,t]),()=>t(e.getInitialState()));return _t.useDebugValue(r),r}const Ws=e=>{const t=Ks(e),r=s=>Us(t,s);return Object.assign(r,t),r},vr=e=>Ws;function tn(e,t){let r;try{r=e()}catch{return}return{getItem:a=>{var i;const o=d=>d===null?null:JSON.parse(d,void 0),c=(i=r.getItem(a))!=null?i:null;return c instanceof Promise?c.then(o):o(c)},setItem:(a,i)=>r.setItem(a,JSON.stringify(i,void 0)),removeItem:a=>r.removeItem(a)}}const Bt=e=>t=>{try{const r=e(t);return r instanceof Promise?r:{then(s){return Bt(s)(r)},catch(s){return this}}}catch(r){return{then(s){return this},catch(s){return Bt(s)(r)}}}},Gs=(e,t)=>(r,s,a)=>{let i={storage:tn(()=>window.localStorage),partialize:b=>b,version:0,merge:(b,$)=>({...$,...b}),...t},o=!1,c=0;const d=new Set,l=new Set;let h=i.storage;if(!h)return e((...b)=>{console.warn(`[zustand persist middleware] Unable to update item '${i.name}', the given storage is currently unavailable.`),r(...b)},s,a);const m=()=>{const b=i.partialize({...s()});return h.setItem(i.name,{state:b,version:i.version})},u=a.setState;a.setState=(...b)=>(u(...b),m());const f=e((...b)=>(r(...b),m()),s,a);a.getInitialState=()=>f;let j;const I=()=>{var b,$;if(!h)return;const D=++c;o=!1,d.forEach(x=>{var O;return x((O=s())!=null?O:f)});const C=(($=i.onRehydrateStorage)==null?void 0:$.call(i,(b=s())!=null?b:f))||void 0;return Bt(h.getItem.bind(h))(i.name).then(x=>{if(x)if(typeof x.version=="number"&&x.version!==i.version){if(i.migrate){const O=i.migrate(x.state,x.version);return O instanceof Promise?O.then(v=>[!0,v]):[!0,O]}console.error("State loaded from storage couldn't be migrated since no migrate function was provided")}else return[!1,x.state];return[!1,void 0]}).then(x=>{var O;if(D!==c)return;const[v,M]=x;if(j=i.merge(M,(O=s())!=null?O:f),r(j,!0),v)return m()}).then(()=>{D===c&&(C==null||C(s(),void 0),j=s(),o=!0,l.forEach(x=>x(j)))}).catch(x=>{D===c&&(C==null||C(void 0,x))})};return a.persist={setOptions:b=>{i={...i,...b},b.storage&&(h=b.storage)},clearStorage:()=>{++c,h==null||h.removeItem(i.name)},getOptions:()=>i,rehydrate:()=>I(),hasHydrated:()=>o,onHydrate:b=>(d.add(b),()=>{d.delete(b)}),onFinishHydration:b=>(l.add(b),()=>{l.delete(b)})},i.skipHydration||I(),j||f},wr=Gs;class Qs extends Error{constructor(r,s,a){super(r);jt(this,"status");jt(this,"errors");this.name="ApiError",this.status=s,this.errors=a}}const Ys="http://localhost:8000/api/v1";function Js(){return typeof window>"u"?null:window.localStorage.getItem("pt-token")}function Oe(e){typeof window>"u"||(e?window.localStorage.setItem("pt-token",e):window.localStorage.removeItem("pt-token"))}async function Xs(e,t={}){const{method:r="GET",body:s,headers:a,isForm:i}=t,o=Js(),c={Accept:"application/json",...a};o&&(c.Authorization=`Bearer ${o}`),s!==void 0&&!i&&(c["Content-Type"]="application/json");const d=await fetch(`${Ys}${e}`,{method:r,headers:c,body:s!==void 0?i?s:JSON.stringify(s):void 0});let l=null;try{l=await d.json()}catch{l=null}if(!d.ok){const h=l&&l.message||(d.status===401?"Session expired. Please log in again.":"Something went wrong."),m=d.status;throw m===401&&(Oe(null),window.dispatchEvent(new CustomEvent("auth:unauthorized"))),new Qs(h,m,l==null?void 0:l.errors)}return l??{success:!0,message:"",data:{}}}async function w(e,t={}){return(await Xs(e,t)).data}function qt(e,t,r="POST"){return w(e,{method:r,body:t,isForm:!0})}function Ke(e={}){const t=new URLSearchParams;for(const[s,a]of Object.entries(e))a!=null&&a!==""&&t.set(s,String(a));const r=t.toString();return r?`?${r}`:""}const nn={login:async(e,t)=>w("/auth/login/email",{method:"POST",body:{email:e,password:t}}),register:async e=>w("/auth/partner/register",{method:"POST",body:e}),reapply:async e=>w("/auth/partner/reapply",{method:"POST",body:e})},z={profile:()=>w("/driver/profile"),update:e=>w("/driver/profile",{method:"PUT",body:e}),updateBank:e=>w("/driver/bank-details",{method:"POST",body:e}),uploadDocuments:e=>{const t=new FormData;return e.forEach((r,s)=>{t.append(`documents[${s}][type]`,r.type),t.append(`documents[${s}][file]`,r.file)}),qt("/driver/documents",t)},toggleAvailability:()=>w("/driver/availability",{method:"POST"}),updateLocation:(e,t)=>w("/driver/location",{method:"POST",body:{latitude:e,longitude:t}}),incomingRequests:()=>w("/driver/incoming-requests"),acceptRequest:e=>w(`/driver/requests/${e}/accept`,{method:"POST"}),rejectRequest:e=>w(`/driver/requests/${e}/reject`,{method:"POST"}),activeTrip:()=>w("/driver/trips/active"),updateTripStatus:(e,t)=>w(`/driver/trips/${e}/status`,{method:"POST",body:{status:t}}),verifyOtp:(e,t)=>w(`/driver/rides/${e}/verify-customer-otp`,{method:"POST",body:{otp:t}}),cashCollect:(e,t)=>w(`/driver/rides/${e}/cash-collect`,{method:"POST",body:{method:t}}),settleCash:e=>w(`/driver/rides/${e}/cash-settle`,{method:"POST"}),earnings:()=>w("/driver/earnings"),withdrawals:e=>w(`/driver/withdrawals${Ke(e)}`),requestWithdrawal:e=>w("/driver/withdrawals",{method:"POST",body:{amount:e}}),wallet:()=>w("/driver/wallet"),walletTopup:(e,t,r)=>w("/driver/wallet/topup",{method:"POST",body:{amount:e,payment_method:t,idempotency_key:r}}),verifyWalletTopup:e=>w("/driver/wallet/verify-topup",{method:"POST",body:e}),walletTransactions:e=>w(`/driver/wallet/transactions${Ke(e)}`)},jr={list:()=>w("/vehicle-types")},Zs={list:()=>w("/zones")},ea={maps:()=>w("/config/maps")},q={profile:()=>w("/delivery-partner/profile"),update:e=>w("/delivery-partner/profile",{method:"PUT",body:e}),updateBank:e=>w("/delivery-partner/bank-details",{method:"POST",body:e}),uploadDocuments:e=>{const t=new FormData;return e.forEach((r,s)=>{t.append(`documents[${s}][type]`,r.type),t.append(`documents[${s}][file]`,r.file)}),qt("/delivery-partner/documents",t)},toggleAvailability:()=>w("/delivery-partner/availability",{method:"POST"}),updateLocation:(e,t)=>w("/delivery-partner/location",{method:"POST",body:{latitude:e,longitude:t}}),incomingOrders:()=>w("/delivery-partner/incoming-orders"),activeJob:()=>w("/delivery-partner/active-job"),acceptOrder:e=>w(`/delivery-partner/orders/${e}/accept`,{method:"POST"}),rejectOrder:e=>w(`/delivery-partner/orders/${e}/reject`,{method:"POST"}),updateOrderStatus:(e,t)=>w(`/delivery-partner/orders/${e}/status`,{method:"POST",body:{status:t}}),confirmPayment:(e,t)=>w(`/delivery-partner/orders/${e}/confirm-payment`,{method:"POST",body:{method:t}}),settleCash:e=>w(`/delivery-partner/orders/${e}/settle-cash`,{method:"POST"}),requestDeliveryOtp:e=>w(`/delivery-partner/orders/${e}/delivery-otp`,{method:"POST"}),verifyDeliveryOtp:(e,t)=>w(`/delivery-partner/orders/${e}/verify-delivery-otp`,{method:"POST",body:{otp:t}}),uploadProof:(e,t,r)=>{const s=new FormData;return s.append("proof_image",t),r&&s.append("notes",r),qt(`/delivery-partner/orders/${e}/proof`,s)},earnings:e=>w(`/delivery-partner/earnings${Ke(e)}`),withdrawals:e=>w(`/delivery-partner/withdrawals${Ke(e)}`),requestWithdrawal:e=>w("/delivery-partner/withdrawals",{method:"POST",body:{amount:e}}),wallet:()=>w("/delivery-partner/wallet"),walletTopup:(e,t,r)=>w("/delivery-partner/wallet/topup",{method:"POST",body:{amount:e,payment_method:t,idempotency_key:r}}),verifyWalletTopup:e=>w("/delivery-partner/wallet/verify-topup",{method:"POST",body:e}),walletTransactions:e=>w(`/delivery-partner/wallet/transactions${Ke(e)}`)},_r=new $s({defaultOptions:{queries:{staleTime:1e3*60,retry:1}}});function Ne(e){return!!e&&typeof e=="object"&&"stops"in e&&Array.isArray(e.stops)}const Nt={activeRide:null,activeOrder:null},An=["status","payment_status","payment_method","delivery_payment_collected_at","delivery_payment_collected_via","delivery_payment_settled_at","delivery_otp_verified_at"];function Nr(e,t){if(e===t)return!0;if(!e||!t)return e===t;const r=Ne(e),s=Ne(t);if(r!==s)return!1;if(r&&s)return e.batch_id!==t.batch_id||e.stop_count!==t.stop_count||e.status!==t.status||e.stops.length!==t.stops.length?!1:e.stops.every((o,c)=>{const d=t.stops[c];return!d||o.order_id!==d.order_id||o.sequence!==d.sequence||o.status!==d.status?!1:An.every(l=>o.order[l]===d.order[l])});if(Ne(e)||Ne(t))return!1;const a=e,i=t;return a.id!==i.id?!1:An.every(o=>a[o]===i[o])}function ta(e,t){var r;if(!e)return e;if(Ne(e)){if(!e.stops.some(a=>a.order_id===t.id))return e;const s=e.stops.map(a=>a.order_id===t.id?{...a,order:t,status:t.status}:a);return s.every(a=>na(a.order.status))?null:{...e,order:((r=e.order)==null?void 0:r.id)===t.id?t:e.order,orders:e.orders.map(a=>a.id===t.id?t:a),stops:s}}return e.id===t.id?t:e}function na(e){return["DELIVERED","CANCELLED"].includes((e??"").toUpperCase())}const kr=["status","payment_status","payment_method","cash_collected","cash_collected_amount","cash_collected_at","cash_collected_via","cash_settled","cash_settled_at","otp_verified"];function ra(e,t){return e===t?!0:!e||!t?e===t:e.id!==t.id?!1:kr.every(r=>e[r]===t[r])}const se=vr()(wr(e=>({...Nt,setActiveRide:t=>e({activeRide:t}),setActiveOrder:t=>e(r=>{const s=typeof t=="function"?t(r.activeOrder):t;return Nr(r.activeOrder,s)?r:{activeOrder:s}}),clear:()=>e({...Nt})}),{name:"pt-job",version:5,storage:tn(()=>sessionStorage),migrate:()=>({...Nt}),merge:(e,t)=>{const r=e??{};return{...t,...r,activeRide:r.activeRide??null,activeOrder:sa(r.activeOrder)?r.activeOrder:null}}}));function sa(e){return!e||typeof e!="object"||!("status"in e)?!1:Ne(e)?Array.isArray(e.stops):"id"in e}function aa(e,t){var i;const r=((i=e.roles)==null?void 0:i.map(o=>o.slug))??[],s=r.includes("driver"),a=r.includes("delivery_partner");return t==="driver"&&s?"driver":t==="delivery_partner"&&a||a?"delivery_partner":s?"driver":null}async function Ze(e){return e==="driver"?z.profile():q.profile()}const R=vr()(wr((e,t)=>({token:null,user:null,role:null,profile:null,initialized:!1,clearSessionState:()=>{_r.clear(),se.getState().clear()},initialize:async()=>{const{token:r,role:s}=t();if(!r||!s){Oe(null),e({initialized:!0});return}Oe(r);try{const a=await Ze(s);e({profile:a,initialized:!0})}catch{e({token:null,user:null,role:null,profile:null,initialized:!0})}},login:async(r,s)=>{const{user:a,token:i}=await nn.login(r,s),o=t().role,c=aa(a,o);if(!c)throw new Error("This account is not a driver or delivery partner.");t().clearSessionState(),Oe(i);const d=await Ze(c);return e({token:i,user:a,role:c,profile:d,initialized:!0}),c},switchRole:async()=>{var c;const{user:r,role:s}=t(),a=((c=r==null?void 0:r.roles)==null?void 0:c.map(d=>d.slug))??[],i=s==="driver"&&a.includes("delivery_partner")?"delivery_partner":s==="delivery_partner"&&a.includes("driver")?"driver":s??"driver";if(i===s)return;t().clearSessionState();const o=await Ze(i);e({role:i,profile:o})},refreshProfile:async()=>{const{role:r,token:s}=t();if(!r||!s)return;Oe(s);const a=await Ze(r);e({profile:a})},setOnline:r=>{const{profile:s}=t();s&&e({profile:{...s,is_online:r}})},logout:()=>{t().clearSessionState(),Oe(null),e({token:null,user:null,role:null,profile:null,initialized:!0})}}),{name:"pt-auth",storage:tn(()=>localStorage),partialize:e=>({token:e.token,user:e.user,role:e.role,profile:e.profile})}));function ia(){const{initialized:e,token:t}=R(),r=gr();return p.useEffect(()=>{e||R.getState().initialize()},[e]),e?t?n.jsx(en,{}):n.jsx(br,{to:"/login",replace:!0,state:{from:r.pathname}}):n.jsx("div",{className:"flex min-h-dvh items-center justify-center bg-ink-50",children:n.jsxs("div",{className:"flex flex-col items-center gap-3",children:[n.jsx("div",{className:"h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"}),n.jsx("p",{className:"text-sm text-neutral-400",children:"Loading partner hub…"})]})})}/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oa=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),Sr=(...e)=>e.filter((t,r,s)=>!!t&&t.trim()!==""&&s.indexOf(t)===r).join(" ").trim();/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var la={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ca=p.forwardRef(({color:e="currentColor",size:t=24,strokeWidth:r=2,absoluteStrokeWidth:s,className:a="",children:i,iconNode:o,...c},d)=>p.createElement("svg",{ref:d,...la,width:t,height:t,stroke:e,strokeWidth:s?Number(r)*24/Number(t):r,className:Sr("lucide",a),...c},[...o.map(([l,h])=>p.createElement(l,h)),...Array.isArray(i)?i:[i]]));/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=(e,t)=>{const r=p.forwardRef(({className:s,...a},i)=>p.createElement(ca,{ref:i,iconNode:t,className:Sr(`lucide-${oa(e)}`,s),...a}));return r.displayName=`${e}`,r};/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const rn=A("ArrowDownLeft",[["path",{d:"M17 7 7 17",key:"15tmo1"}],["path",{d:"M17 17H7V7",key:"1org7z"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const da=A("ArrowLeft",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Er=A("ArrowRight",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ua=A("ArrowUpRight",[["path",{d:"M7 7h10v10",key:"1tivn9"}],["path",{d:"M7 17 17 7",key:"1vkiza"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const lt=A("Banknote",[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ma=A("BellRing",[["path",{d:"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9",key:"1qo2s2"}],["path",{d:"M10.3 21a1.94 1.94 0 0 0 3.4 0",key:"qgo35s"}],["path",{d:"M4 2C2.8 3.7 2 5.7 2 8",key:"tap9e0"}],["path",{d:"M22 8c0-2.3-.8-4.3-2-6",key:"5bb3ad"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const le=A("Bike",[["circle",{cx:"18.5",cy:"17.5",r:"3.5",key:"15x4ox"}],["circle",{cx:"5.5",cy:"17.5",r:"3.5",key:"1noe27"}],["circle",{cx:"15",cy:"5",r:"1",key:"19l28e"}],["path",{d:"M12 17.5V14l-3-3 4-3 2 3h2",key:"1npguv"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ce=A("CarTaxiFront",[["path",{d:"M10 2h4",key:"n1abiw"}],["path",{d:"m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8",key:"1imjwt"}],["path",{d:"M7 14h.01",key:"1qa3f1"}],["path",{d:"M17 14h.01",key:"7oqj8z"}],["rect",{width:"18",height:"8",x:"3",y:"10",rx:"2",key:"a7itu8"}],["path",{d:"M5 18v2",key:"ppbyun"}],["path",{d:"M19 18v2",key:"gy7782"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Cr=A("Car",[["path",{d:"M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2",key:"5owen"}],["circle",{cx:"7",cy:"17",r:"2",key:"u2ysq9"}],["path",{d:"M9 17h6",key:"r8uit2"}],["circle",{cx:"17",cy:"17",r:"2",key:"axvx0g"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ir=A("ChevronDown",[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ha=A("ChevronLeft",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pa=A("ChevronRight",[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fa=A("Clock3",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16.5 12",key:"1aq6pp"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xa=A("FileCheck",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"m9 15 2 2 4-4",key:"1grp1n"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ga=A("Hourglass",[["path",{d:"M5 22h14",key:"ehvnwv"}],["path",{d:"M5 2h14",key:"pdyrp9"}],["path",{d:"M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22",key:"1d314k"}],["path",{d:"M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2",key:"1vvvr6"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ba=A("IdCard",[["path",{d:"M16 10h2",key:"8sgtl7"}],["path",{d:"M16 14h2",key:"epxaof"}],["path",{d:"M6.17 15a3 3 0 0 1 5.66 0",key:"n6f512"}],["circle",{cx:"9",cy:"11",r:"2",key:"yxgjnd"}],["rect",{x:"2",y:"5",width:"20",height:"14",rx:"2",key:"qneu4z"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ya=A("Landmark",[["line",{x1:"3",x2:"21",y1:"22",y2:"22",key:"j8o0r"}],["line",{x1:"6",x2:"6",y1:"18",y2:"11",key:"10tf0k"}],["line",{x1:"10",x2:"10",y1:"18",y2:"11",key:"54lgf6"}],["line",{x1:"14",x2:"14",y1:"18",y2:"11",key:"380y"}],["line",{x1:"18",x2:"18",y1:"18",y2:"11",key:"1kevvc"}],["polygon",{points:"12 2 20 7 4 7",key:"jkujk7"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const va=A("LayoutDashboard",[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ct=A("LoaderCircle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vt=A("LogOut",[["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}],["polyline",{points:"16 17 21 12 16 7",key:"1gabdz"}],["line",{x1:"21",x2:"9",y1:"12",y2:"12",key:"1uyos4"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wa=A("Menu",[["line",{x1:"4",x2:"20",y1:"12",y2:"12",key:"1e0a9i"}],["line",{x1:"4",x2:"20",y1:"6",y2:"6",key:"1owob3"}],["line",{x1:"4",x2:"20",y1:"18",y2:"18",key:"yk5zj1"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ja=A("Navigation",[["polygon",{points:"3 11 22 2 13 21 11 13 3 11",key:"1ltx0t"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _a=A("Phone",[["path",{d:"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",key:"foiqr5"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Tr=A("Plus",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ar=A("RefreshCw",[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Na=A("Settings",[["path",{d:"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",key:"1qme2f"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Dr=A("ShieldCheck",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ka=A("ShoppingBasket",[["path",{d:"m15 11-1 9",key:"5wnq3a"}],["path",{d:"m19 11-4-7",key:"cnml18"}],["path",{d:"M2 11h20",key:"3eubbj"}],["path",{d:"m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4",key:"yiazzp"}],["path",{d:"M4.5 15.5h15",key:"13mye1"}],["path",{d:"m5 11 4-7",key:"116ra9"}],["path",{d:"m9 11 1 9",key:"1ojof7"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sa=A("TrendingUp",[["polyline",{points:"22 7 13.5 15.5 8.5 10.5 2 17",key:"126l90"}],["polyline",{points:"16 7 22 7 22 13",key:"kwv8wd"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ea=A("UtensilsCrossed",[["path",{d:"m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8",key:"n7qcjb"}],["path",{d:"M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7",key:"d0u48b"}],["path",{d:"m2.1 21.8 6.4-6.3",key:"yn04lh"}],["path",{d:"m19 5-7 7",key:"194lzd"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ue=A("Wallet",[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ca=A("WifiOff",[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}],["path",{d:"M5 12.859a10 10 0 0 1 5.17-2.69",key:"1dl1wf"}],["path",{d:"M19 12.859a10 10 0 0 0-2.007-1.523",key:"4k23kn"}],["path",{d:"M2 8.82a15 15 0 0 1 4.177-2.643",key:"1grhjp"}],["path",{d:"M22 8.82a15 15 0 0 0-11.288-3.764",key:"z3jwby"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ia=A("Wifi",[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M2 8.82a15 15 0 0 1 20 0",key:"dnpr2z"}],["path",{d:"M5 12.859a10 10 0 0 1 14 0",key:"1x1e6c"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sn=A("X",[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]]),Ta={primary:"bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600",secondary:"bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:outline-neutral-900",outline:"border border-ink-200 bg-white text-neutral-800 hover:bg-ink-50/60 focus-visible:outline-neutral-400",ghost:"bg-transparent text-neutral-700 hover:bg-ink-50/60",danger:"bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",success:"bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600"},Aa={sm:"h-8 px-3 text-xs",md:"h-10 px-4 text-sm"},E=p.forwardRef(({variant:e="primary",size:t="md",loading:r,asChild:s,className:a="",children:i,disabled:o,...c},d)=>{const l=["inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60",Ta[e],Aa[t],a].join(" ");if(s){const h=i;return p.cloneElement(h,{className:[h.props.className,l].filter(Boolean).join(" ")})}return n.jsx("button",{ref:d,className:l,disabled:o||r,...c,children:i})});E.displayName="Button";function J(...e){return e.filter(Boolean).join(" ")}function X(e){const t=Number(e)||0;return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(t)}function T(e){const t=Number(e)||0;return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:2,maximumFractionDigits:2}).format(t)}function an(e){const t=Number(e)||0;return new Intl.NumberFormat("en-IN").format(t)}function on(e){if(!e)return"—";const t=typeof e=="string"?new Date(e):e;return Number.isNaN(t.getTime())?"—":t.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"})}const Da={approved:"bg-emerald-50 text-emerald-700 ring-emerald-200",rejected:"bg-red-50 text-red-700 ring-red-200",pending:"bg-amber-50 text-amber-700 ring-amber-200",suspended:"bg-neutral-100 text-neutral-700 ring-neutral-200",inactive:"bg-neutral-100 text-neutral-700 ring-neutral-200",active:"bg-emerald-50 text-emerald-700 ring-emerald-200",system:"bg-violet-50 text-violet-700 ring-violet-200",online:"bg-emerald-50 text-emerald-700 ring-emerald-200",offline:"bg-neutral-100 text-neutral-700 ring-neutral-200",on_trip:"bg-blue-50 text-blue-700 ring-blue-200",on_delivery:"bg-blue-50 text-blue-700 ring-blue-200",verified:"bg-emerald-50 text-emerald-700 ring-emerald-200",unverified:"bg-amber-50 text-amber-700 ring-amber-200"};function ae({status:e,className:t}){const r=e.toLowerCase();return n.jsx("span",{className:J("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",Da[r]??"bg-neutral-100 text-neutral-700 ring-neutral-200",t),children:e.toLowerCase().replace(/_/g," ")})}let nt=[],be=[],Ra=1;function Ht(){nt.forEach(e=>e([...be]))}function y(e,t="success"){const r=Ra++;be=[...be,{id:r,message:e,type:t}],Ht(),setTimeout(()=>{be=be.filter(s=>s.id!==r),Ht()},4e3)}function Pa(){const[e,t]=p.useState([]);p.useEffect(()=>(nt.push(t),t([...be]),()=>{nt=nt.filter(a=>a!==t)}),[]);const r=a=>{be=be.filter(i=>i.id!==a),Ht()},s={success:"border-emerald-200 bg-emerald-50 text-emerald-800",error:"border-red-200 bg-red-50 text-red-800",info:"border-ink-200 bg-white text-neutral-800"};return n.jsx("div",{className:"pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4",children:e.map(a=>n.jsxs("div",{className:`pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-card ${s[a.type]}`,children:[n.jsx("span",{children:a.message}),n.jsx("button",{onClick:()=>r(a.id),className:"shrink-0 opacity-50 transition-opacity hover:opacity-100",children:n.jsx(sn,{className:"h-4 w-4"})})]},a.id))})}function Oa(){return n.jsx(Pa,{})}const Dn={pending:{title:"Application under review",body:"Our team is verifying your documents. This usually takes up to 24 hours — you will be able to start working as soon as your profile is approved."},rejected:{title:"Application not approved",body:"Your application was not approved. Update the details below and resubmit, or contact support for help."},suspended:{title:"Account suspended",body:"Your account has been suspended. Contact support to resolve this before you can go online."}};function Ma(){const e=it(),{profile:t,role:r,user:s}=R(),[a,i]=p.useState(!1),o=(t==null?void 0:t.status)??"pending",c=o.toLowerCase().replace(/\s+/g,"_"),d=Dn[c]??Dn.pending,l=c==="rejected",h=r==="driver"?ce:le,m=async()=>{i(!0);try{await nn.reapply({}),await R.getState().refreshProfile(),y("Application resubmitted for review.")}catch(f){y(f instanceof Error?f.message:"Resubmit failed","error")}finally{i(!1)}},u=()=>{R.getState().logout(),e("/login",{replace:!0})};return n.jsx("div",{className:"flex min-h-dvh items-center justify-center bg-ink-50 px-4 py-10",children:n.jsxs("div",{className:J("w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8 shadow-card",r==="driver"?"p-driver":"p-delivery"),children:[n.jsx("div",{className:"mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white",children:n.jsx(h,{className:"h-7 w-7"})}),n.jsx("div",{className:"mb-3 flex items-center justify-center gap-2",children:n.jsx(ae,{status:o==="on_delivery"?"offline":o})}),n.jsx("h1",{className:"mb-2 text-center text-xl font-black text-neutral-900",children:d.title}),n.jsx("p",{className:"mb-5 text-center text-sm leading-relaxed text-neutral-500",children:d.body}),l&&(t==null?void 0:t.rejection_reason)&&n.jsxs("div",{className:"mb-5 rounded-xl border border-red-100 bg-red-50 p-4",children:[n.jsx("p",{className:"mb-1 text-xs font-semibold uppercase tracking-wide text-red-600",children:"Reason"}),n.jsx("p",{className:"text-sm text-red-800",children:t.rejection_reason})]}),n.jsxs("div",{className:"flex flex-col gap-2",children:[l&&n.jsxs(E,{className:"w-full",disabled:a,onClick:()=>void m(),children:[n.jsx(Ar,{className:"h-4 w-4"}),a?"Resubmitting…":"Resubmit application"]}),c==="pending"&&n.jsxs("div",{className:"flex items-center justify-center gap-2 text-sm font-medium text-neutral-500",children:[n.jsx(ga,{className:"h-4 w-4"})," We'll notify you here once reviewed"]}),n.jsxs(E,{variant:"ghost",className:"w-full text-red-600",onClick:u,children:[n.jsx(Vt,{className:"h-4 w-4"})," Sign out"]})]}),s&&n.jsxs("p",{className:"mt-6 text-center text-xs text-neutral-400",children:["Signed in as ",s.name," (",s.email??s.phone,")"]})]})})}const $a=new Set(["pending","rejected","suspended"]);function Fa(){const e=R(t=>{var r;return(r=t.profile)==null?void 0:r.status});return!e||$a.has(e.toLowerCase().replace(/\s+/g,"_"))?n.jsx(Ma,{}):n.jsx(en,{})}const La={1:"Location permission denied. Please allow location access in your browser and try again.",2:"Your location could not be determined. Please try again.",3:"Location request timed out. Please try again."};function ln(){return new Promise((e,t)=>{if(typeof navigator>"u"||!navigator.geolocation){t(new Error("Location services are not supported on this device."));return}navigator.geolocation.getCurrentPosition(r=>e({latitude:r.coords.latitude,longitude:r.coords.longitude}),r=>t(new Error(La[r.code]??"Could not get your location.")),{enableHighAccuracy:!0,timeout:1e4,maximumAge:3e4})})}const Ba=45e3;function qa(){const e=R(a=>a.role),t=R(a=>{var i;return((i=a.profile)==null?void 0:i.is_online)??!1}),r=R(a=>{var i;return((i=a.profile)==null?void 0:i.is_busy)??!1}),s=p.useRef(!1);p.useEffect(()=>{if(!e||!t||r)return;const a=e==="delivery_partner"?q:z,i=async()=>{if(!s.current){s.current=!0;try{const c=await ln();await a.updateLocation(c.latitude,c.longitude)}catch{}finally{s.current=!1}}};s.current||i();const o=window.setInterval(i,Ba);return()=>window.clearInterval(o)},[e,t,r])}function Va(){return qa(),null}const Ha=()=>{};var Rn={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rr=function(e){const t=[];let r=0;for(let s=0;s<e.length;s++){let a=e.charCodeAt(s);a<128?t[r++]=a:a<2048?(t[r++]=a>>6|192,t[r++]=a&63|128):(a&64512)===55296&&s+1<e.length&&(e.charCodeAt(s+1)&64512)===56320?(a=65536+((a&1023)<<10)+(e.charCodeAt(++s)&1023),t[r++]=a>>18|240,t[r++]=a>>12&63|128,t[r++]=a>>6&63|128,t[r++]=a&63|128):(t[r++]=a>>12|224,t[r++]=a>>6&63|128,t[r++]=a&63|128)}return t},Ka=function(e){const t=[];let r=0,s=0;for(;r<e.length;){const a=e[r++];if(a<128)t[s++]=String.fromCharCode(a);else if(a>191&&a<224){const i=e[r++];t[s++]=String.fromCharCode((a&31)<<6|i&63)}else if(a>239&&a<365){const i=e[r++],o=e[r++],c=e[r++],d=((a&7)<<18|(i&63)<<12|(o&63)<<6|c&63)-65536;t[s++]=String.fromCharCode(55296+(d>>10)),t[s++]=String.fromCharCode(56320+(d&1023))}else{const i=e[r++],o=e[r++];t[s++]=String.fromCharCode((a&15)<<12|(i&63)<<6|o&63)}}return t.join("")},Pr={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(e,t){if(!Array.isArray(e))throw Error("encodeByteArray takes an array as a parameter");this.init_();const r=t?this.byteToCharMapWebSafe_:this.byteToCharMap_,s=[];for(let a=0;a<e.length;a+=3){const i=e[a],o=a+1<e.length,c=o?e[a+1]:0,d=a+2<e.length,l=d?e[a+2]:0,h=i>>2,m=(i&3)<<4|c>>4;let u=(c&15)<<2|l>>6,f=l&63;d||(f=64,o||(u=64)),s.push(r[h],r[m],r[u],r[f])}return s.join("")},encodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?btoa(e):this.encodeByteArray(Rr(e),t)},decodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?atob(e):Ka(this.decodeStringToByteArray(e,t))},decodeStringToByteArray(e,t){this.init_();const r=t?this.charToByteMapWebSafe_:this.charToByteMap_,s=[];for(let a=0;a<e.length;){const i=r[e.charAt(a++)],c=a<e.length?r[e.charAt(a)]:0;++a;const l=a<e.length?r[e.charAt(a)]:64;++a;const m=a<e.length?r[e.charAt(a)]:64;if(++a,i==null||c==null||l==null||m==null)throw new za;const u=i<<2|c>>4;if(s.push(u),l!==64){const f=c<<4&240|l>>2;if(s.push(f),m!==64){const j=l<<6&192|m;s.push(j)}}}return s},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let e=0;e<this.ENCODED_VALS.length;e++)this.byteToCharMap_[e]=this.ENCODED_VALS.charAt(e),this.charToByteMap_[this.byteToCharMap_[e]]=e,this.byteToCharMapWebSafe_[e]=this.ENCODED_VALS_WEBSAFE.charAt(e),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[e]]=e,e>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(e)]=e,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(e)]=e)}}};class za extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const Ua=function(e){const t=Rr(e);return Pr.encodeByteArray(t,!0)},Or=function(e){return Ua(e).replace(/\./g,"")},Wa=function(e){try{return Pr.decodeString(e,!0)}catch(t){console.error("base64Decode failed: ",t)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ga(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Qa=()=>Ga().__FIREBASE_DEFAULTS__,Ya=()=>{if(typeof process>"u"||typeof Rn>"u")return;const e=Rn.__FIREBASE_DEFAULTS__;if(e)return JSON.parse(e)},Ja=()=>{if(typeof document>"u")return;let e;try{e=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const t=e&&Wa(e[1]);return t&&JSON.parse(t)},Xa=()=>{try{return Ha()||Qa()||Ya()||Ja()}catch(e){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${e}`);return}},Mr=()=>{var e;return(e=Xa())==null?void 0:e.config};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Za{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((t,r)=>{this.resolve=t,this.reject=r})}wrapCallback(t){return(r,s)=>{r?this.reject(r):this.resolve(s),typeof t=="function"&&(this.promise.catch(()=>{}),t.length===1?t(r):t(r,s))}}}function $r(){try{return typeof indexedDB=="object"}catch{return!1}}function Fr(){return new Promise((e,t)=>{try{let r=!0;const s="validate-browser-context-for-indexeddb-analytics-module",a=self.indexedDB.open(s);a.onsuccess=()=>{a.result.close(),r||self.indexedDB.deleteDatabase(s),e(!0)},a.onupgradeneeded=()=>{r=!1},a.onerror=()=>{var i;t(((i=a.error)==null?void 0:i.message)||"")}}catch(r){t(r)}})}function ei(){return!(typeof navigator>"u"||!navigator.cookieEnabled)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ti="FirebaseError";class Fe extends Error{constructor(t,r,s){super(r),this.code=t,this.customData=s,this.name=ti,Object.setPrototypeOf(this,Fe.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,dt.prototype.create)}}class dt{constructor(t,r,s){this.service=t,this.serviceName=r,this.errors=s}create(t,...r){const s=r[0]||{},a=`${this.service}/${t}`,i=this.errors[t],o=i?ni(i,s):"Error",c=`${this.serviceName}: ${o} (${a}).`;return new Fe(a,c,s)}}function ni(e,t){try{let r=0,s="";for(;r<e.length;){const a=e.indexOf("{$",r);if(a===-1){s+=e.substring(r);break}const i=e.indexOf("}",a+2);if(i===-1){s+=e.substring(r);break}const o=e.substring(a+2,i),c=t[o];s+=e.substring(r,a)+(c!=null?String(c):`<${o}?>`),r=i+1}return s}catch{return e}}function Kt(e,t){if(e===t)return!0;const r=Object.keys(e),s=Object.keys(t);for(const a of r){if(!s.includes(a))return!1;const i=e[a],o=t[a];if(Pn(i)&&Pn(o)){if(!Kt(i,o))return!1}else if(i!==o)return!1}for(const a of s)if(!r.includes(a))return!1;return!0}function Pn(e){return e!==null&&typeof e=="object"}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function cn(e){return e&&e._delegate?e._delegate:e}class ve{constructor(t,r,s){this.name=t,this.instanceFactory=r,this.type=s,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(t){return this.instantiationMode=t,this}setMultipleInstances(t){return this.multipleInstances=t,this}setServiceProps(t){return this.serviceProps=t,this}setInstanceCreatedCallback(t){return this.onInstanceCreated=t,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const _e="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ri{constructor(t,r){this.name=t,this.container=r,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(t){const r=this.normalizeInstanceIdentifier(t);if(!this.instancesDeferred.has(r)){const s=new Za;if(this.instancesDeferred.set(r,s),this.isInitialized(r)||this.shouldAutoInitialize())try{const a=this.getOrInitializeService({instanceIdentifier:r});a&&s.resolve(a)}catch{}}return this.instancesDeferred.get(r).promise}getImmediate(t){const r=this.normalizeInstanceIdentifier(t==null?void 0:t.identifier),s=(t==null?void 0:t.optional)??!1;if(this.isInitialized(r)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:r})}catch(a){if(s)return null;throw a}else{if(s)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(t){if(t.name!==this.name)throw Error(`Mismatching Component ${t.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=t,!!this.shouldAutoInitialize()){if(ai(t))try{this.getOrInitializeService({instanceIdentifier:_e})}catch{}for(const[r,s]of this.instancesDeferred.entries()){const a=this.normalizeInstanceIdentifier(r);try{const i=this.getOrInitializeService({instanceIdentifier:a});s.resolve(i)}catch{}}}}clearInstance(t=_e){this.instancesDeferred.delete(t),this.instancesOptions.delete(t),this.instances.delete(t)}async delete(){const t=Array.from(this.instances.values());await Promise.all([...t.filter(r=>"INTERNAL"in r).map(r=>r.INTERNAL.delete()),...t.filter(r=>"_delete"in r).map(r=>r._delete())])}isComponentSet(){return this.component!=null}isInitialized(t=_e){return this.instances.has(t)}getOptions(t=_e){return this.instancesOptions.get(t)||{}}initialize(t={}){const{options:r={}}=t,s=this.normalizeInstanceIdentifier(t.instanceIdentifier);if(this.isInitialized(s))throw Error(`${this.name}(${s}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const a=this.getOrInitializeService({instanceIdentifier:s,options:r});for(const[i,o]of this.instancesDeferred.entries()){const c=this.normalizeInstanceIdentifier(i);s===c&&o.resolve(a)}return a}onInit(t,r){const s=this.normalizeInstanceIdentifier(r),a=this.onInitCallbacks.get(s)??new Set;a.add(t),this.onInitCallbacks.set(s,a);const i=this.instances.get(s);return i&&t(i,s),()=>{a.delete(t)}}invokeOnInitCallbacks(t,r){const s=this.onInitCallbacks.get(r);if(s)for(const a of s)try{a(t,r)}catch{}}getOrInitializeService({instanceIdentifier:t,options:r={}}){let s=this.instances.get(t);if(!s&&this.component&&(s=this.component.instanceFactory(this.container,{instanceIdentifier:si(t),options:r}),this.instances.set(t,s),this.instancesOptions.set(t,r),this.invokeOnInitCallbacks(s,t),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,t,s)}catch{}return s||null}normalizeInstanceIdentifier(t=_e){return this.component?this.component.multipleInstances?t:_e:t}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function si(e){return e===_e?void 0:e}function ai(e){return e.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ii{constructor(t){this.name=t,this.providers=new Map}addComponent(t){const r=this.getProvider(t.name);if(r.isComponentSet())throw new Error(`Component ${t.name} has already been registered with ${this.name}`);r.setComponent(t)}addOrOverwriteComponent(t){this.getProvider(t.name).isComponentSet()&&this.providers.delete(t.name),this.addComponent(t)}getProvider(t){if(this.providers.has(t))return this.providers.get(t);const r=new ri(t,this);return this.providers.set(t,r),r}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var L;(function(e){e[e.DEBUG=0]="DEBUG",e[e.VERBOSE=1]="VERBOSE",e[e.INFO=2]="INFO",e[e.WARN=3]="WARN",e[e.ERROR=4]="ERROR",e[e.SILENT=5]="SILENT"})(L||(L={}));const oi={debug:L.DEBUG,verbose:L.VERBOSE,info:L.INFO,warn:L.WARN,error:L.ERROR,silent:L.SILENT},li=L.INFO,ci={[L.DEBUG]:"log",[L.VERBOSE]:"log",[L.INFO]:"info",[L.WARN]:"warn",[L.ERROR]:"error"},di=(e,t,...r)=>{if(t<e.logLevel)return;const s=new Date().toISOString(),a=ci[t];if(a)console[a](`[${s}]  ${e.name}:`,...r);else throw new Error(`Attempted to log a message with an invalid logType (value: ${t})`)};class ui{constructor(t){this.name=t,this._logLevel=li,this._logHandler=di,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(t){if(!(t in L))throw new TypeError(`Invalid value "${t}" assigned to \`logLevel\``);this._logLevel=t}setLogLevel(t){this._logLevel=typeof t=="string"?oi[t]:t}get logHandler(){return this._logHandler}set logHandler(t){if(typeof t!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=t}get userLogHandler(){return this._userLogHandler}set userLogHandler(t){this._userLogHandler=t}debug(...t){this._userLogHandler&&this._userLogHandler(this,L.DEBUG,...t),this._logHandler(this,L.DEBUG,...t)}log(...t){this._userLogHandler&&this._userLogHandler(this,L.VERBOSE,...t),this._logHandler(this,L.VERBOSE,...t)}info(...t){this._userLogHandler&&this._userLogHandler(this,L.INFO,...t),this._logHandler(this,L.INFO,...t)}warn(...t){this._userLogHandler&&this._userLogHandler(this,L.WARN,...t),this._logHandler(this,L.WARN,...t)}error(...t){this._userLogHandler&&this._userLogHandler(this,L.ERROR,...t),this._logHandler(this,L.ERROR,...t)}}const mi=(e,t)=>t.some(r=>e instanceof r);let On,Mn;function hi(){return On||(On=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function pi(){return Mn||(Mn=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const Lr=new WeakMap,zt=new WeakMap,Br=new WeakMap,kt=new WeakMap,dn=new WeakMap;function fi(e){const t=new Promise((r,s)=>{const a=()=>{e.removeEventListener("success",i),e.removeEventListener("error",o)},i=()=>{r(me(e.result)),a()},o=()=>{s(e.error),a()};e.addEventListener("success",i),e.addEventListener("error",o)});return t.then(r=>{r instanceof IDBCursor&&Lr.set(r,e)}).catch(()=>{}),dn.set(t,e),t}function xi(e){if(zt.has(e))return;const t=new Promise((r,s)=>{const a=()=>{e.removeEventListener("complete",i),e.removeEventListener("error",o),e.removeEventListener("abort",o)},i=()=>{r(),a()},o=()=>{s(e.error||new DOMException("AbortError","AbortError")),a()};e.addEventListener("complete",i),e.addEventListener("error",o),e.addEventListener("abort",o)});zt.set(e,t)}let Ut={get(e,t,r){if(e instanceof IDBTransaction){if(t==="done")return zt.get(e);if(t==="objectStoreNames")return e.objectStoreNames||Br.get(e);if(t==="store")return r.objectStoreNames[1]?void 0:r.objectStore(r.objectStoreNames[0])}return me(e[t])},set(e,t,r){return e[t]=r,!0},has(e,t){return e instanceof IDBTransaction&&(t==="done"||t==="store")?!0:t in e}};function gi(e){Ut=e(Ut)}function bi(e){return e===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(t,...r){const s=e.call(St(this),t,...r);return Br.set(s,t.sort?t.sort():[t]),me(s)}:pi().includes(e)?function(...t){return e.apply(St(this),t),me(Lr.get(this))}:function(...t){return me(e.apply(St(this),t))}}function yi(e){return typeof e=="function"?bi(e):(e instanceof IDBTransaction&&xi(e),mi(e,hi())?new Proxy(e,Ut):e)}function me(e){if(e instanceof IDBRequest)return fi(e);if(kt.has(e))return kt.get(e);const t=yi(e);return t!==e&&(kt.set(e,t),dn.set(t,e)),t}const St=e=>dn.get(e);function ut(e,t,{blocked:r,upgrade:s,blocking:a,terminated:i}={}){const o=indexedDB.open(e,t),c=me(o);return s&&o.addEventListener("upgradeneeded",d=>{s(me(o.result),d.oldVersion,d.newVersion,me(o.transaction),d)}),r&&o.addEventListener("blocked",d=>r(d.oldVersion,d.newVersion,d)),c.then(d=>{i&&d.addEventListener("close",()=>i()),a&&d.addEventListener("versionchange",l=>a(l.oldVersion,l.newVersion,l))}).catch(()=>{}),c}function rt(e,{blocked:t}={}){const r=indexedDB.deleteDatabase(e);return t&&r.addEventListener("blocked",s=>t(s.oldVersion,s)),me(r).then(()=>{})}const vi=["get","getKey","getAll","getAllKeys","count"],wi=["put","add","delete","clear"],Et=new Map;function $n(e,t){if(!(e instanceof IDBDatabase&&!(t in e)&&typeof t=="string"))return;if(Et.get(t))return Et.get(t);const r=t.replace(/FromIndex$/,""),s=t!==r,a=wi.includes(r);if(!(r in(s?IDBIndex:IDBObjectStore).prototype)||!(a||vi.includes(r)))return;const i=async function(o,...c){const d=this.transaction(o,a?"readwrite":"readonly");let l=d.store;return s&&(l=l.index(c.shift())),(await Promise.all([l[r](...c),a&&d.done]))[0]};return Et.set(t,i),i}gi(e=>({...e,get:(t,r,s)=>$n(t,r)||e.get(t,r,s),has:(t,r)=>!!$n(t,r)||e.has(t,r)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ji{constructor(t){this.container=t}getPlatformInfoString(){return this.container.getProviders().map(r=>{if(_i(r)){const s=r.getImmediate();return`${s.library}/${s.version}`}else return null}).filter(r=>r).join(" ")}}function _i(e){const t=e.getComponent();return(t==null?void 0:t.type)==="VERSION"}const Wt="@firebase/app",Fn="0.16.4";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const fe=new ui("@firebase/app"),Ni="@firebase/app-compat",ki="@firebase/analytics-compat",Si="@firebase/analytics",Ei="@firebase/app-check-compat",Ci="@firebase/app-check",Ii="@firebase/auth",Ti="@firebase/auth-compat",Ai="@firebase/database",Di="@firebase/data-connect",Ri="@firebase/database-compat",Pi="@firebase/functions",Oi="@firebase/functions-compat",Mi="@firebase/installations",$i="@firebase/installations-compat",Fi="@firebase/messaging",Li="@firebase/messaging-compat",Bi="@firebase/performance",qi="@firebase/performance-compat",Vi="@firebase/remote-config",Hi="@firebase/remote-config-compat",Ki="@firebase/storage",zi="@firebase/storage-compat",Ui="@firebase/firestore",Wi="@firebase/ai",Gi="@firebase/firestore-compat",Qi="firebase";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Gt="[DEFAULT]",Yi={[Wt]:"fire-core",[Ni]:"fire-core-compat",[Si]:"fire-analytics",[ki]:"fire-analytics-compat",[Ci]:"fire-app-check",[Ei]:"fire-app-check-compat",[Ii]:"fire-auth",[Ti]:"fire-auth-compat",[Ai]:"fire-rtdb",[Di]:"fire-data-connect",[Ri]:"fire-rtdb-compat",[Pi]:"fire-fn",[Oi]:"fire-fn-compat",[Mi]:"fire-iid",[$i]:"fire-iid-compat",[Fi]:"fire-fcm",[Li]:"fire-fcm-compat",[Bi]:"fire-perf",[qi]:"fire-perf-compat",[Vi]:"fire-rc",[Hi]:"fire-rc-compat",[Ki]:"fire-gcs",[zi]:"fire-gcs-compat",[Ui]:"fire-fst",[Gi]:"fire-fst-compat",[Wi]:"fire-vertex","fire-js":"fire-js",[Qi]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const We=new Map,Ji=new Map,Qt=new Map;function Ln(e,t){try{e.container.addComponent(t)}catch(r){fe.debug(`Component ${t.name} failed to register with FirebaseApp ${e.name}`,r)}}function Ee(e){const t=e.name;if(Qt.has(t))return fe.debug(`There were multiple attempts to register component ${t}.`),!1;Qt.set(t,e);for(const r of We.values())Ln(r,e);for(const r of Ji.values())Ln(r,e);return!0}function un(e,t){const r=e.container.getProvider("heartbeat").getImmediate({optional:!0});return r&&r.triggerHeartbeat(),e.container.getProvider(t)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xi={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different {$mismatchedParam}. Existing: '{$oldValue}'. New: '{$newValue}'.","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},ue=new dt("app","Firebase",Xi);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zi{constructor(t,r,s){this._isDeleted=!1,this._options={...t},this._config={...r},this._name=r.name,this._automaticDataCollectionEnabled=r.automaticDataCollectionEnabled,this._container=s,this.container.addComponent(new ve("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(t){this.checkDestroyed(),this._automaticDataCollectionEnabled=t}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(t){this._isDeleted=t}checkDestroyed(){if(this.isDeleted)throw ue.create("app-deleted",{appName:this._name})}}function qr(e,t={}){let r=e;typeof t!="object"&&(t={name:t});const s={name:Gt,automaticDataCollectionEnabled:!0,...t},a=s.name;if(typeof a!="string"||!a)throw ue.create("bad-app-name",{appName:String(a)});if(r||(r=Mr()),!r)throw ue.create("no-options");const i=We.get(a);if(i)if(Kt(r,i.options)){if(Kt(s,i.config))return i;throw ue.create("duplicate-app",{appName:a,mismatchedParam:"config",oldValue:JSON.stringify(i.config),newValue:JSON.stringify(s)})}else throw ue.create("duplicate-app",{appName:a,mismatchedParam:"options",oldValue:JSON.stringify(i.options),newValue:JSON.stringify(r)});const o=new ii(a);for(const d of Qt.values())o.addComponent(d);const c=new Zi(r,s,o);return We.set(a,c),c}function Vr(e=Gt){const t=We.get(e);if(!t&&e===Gt&&Mr())return qr();if(!t)throw ue.create("no-app",{appName:e});return t}function eo(){return Array.from(We.values())}function ye(e,t,r){let s=Yi[e]??e;r&&(s+=`-${r}`);const a=s.match(/\s|\//),i=t.match(/\s|\//);if(a||i){const o=[`Unable to register library "${s}" with version "${t}":`];a&&o.push(`library name "${s}" contains illegal characters (whitespace or "/")`),a&&i&&o.push("and"),i&&o.push(`version name "${t}" contains illegal characters (whitespace or "/")`),fe.warn(o.join(" "));return}Ee(new ve(`${s}-version`,()=>({library:s,version:t}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const to="firebase-heartbeat-database",no=1,Ge="firebase-heartbeat-store";let Ct=null;function Hr(){return Ct||(Ct=ut(to,no,{upgrade:(e,t)=>{switch(t){case 0:try{e.createObjectStore(Ge)}catch(r){console.warn(r)}}}}).catch(e=>{throw ue.create("idb-open",{originalErrorMessage:e.message})})),Ct}async function ro(e){try{const r=(await Hr()).transaction(Ge),s=await r.objectStore(Ge).get(Kr(e));return await r.done,s}catch(t){if(t instanceof Fe)fe.warn(t.message);else{const r=ue.create("idb-get",{originalErrorMessage:t==null?void 0:t.message});fe.warn(r.message)}}}async function Bn(e,t){try{const s=(await Hr()).transaction(Ge,"readwrite");await s.objectStore(Ge).put(t,Kr(e)),await s.done}catch(r){if(r instanceof Fe)fe.warn(r.message);else{const s=ue.create("idb-set",{originalErrorMessage:r==null?void 0:r.message});fe.warn(s.message)}}}function Kr(e){return`${e.name}!${e.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const so=1024,ao=30;class io{constructor(t){this.container=t,this._heartbeatsCache=null;const r=this.container.getProvider("app").getImmediate();this._storage=new lo(r),this._heartbeatsCachePromise=this._storage.read().then(s=>(this._heartbeatsCache=s,s))}async triggerHeartbeat(){var t,r;try{const a=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),i=qn();if(((t=this._heartbeatsCache)==null?void 0:t.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((r=this._heartbeatsCache)==null?void 0:r.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===i||this._heartbeatsCache.heartbeats.some(o=>o.date===i))return;if(this._heartbeatsCache.heartbeats.push({date:i,agent:a}),this._heartbeatsCache.heartbeats.length>ao){const o=co(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(o,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(s){fe.warn(s)}}async getHeartbeatsHeader(){var t;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((t=this._heartbeatsCache)==null?void 0:t.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const r=qn(),{heartbeatsToSend:s,unsentEntries:a}=oo(this._heartbeatsCache.heartbeats),i=Or(JSON.stringify({version:2,heartbeats:s}));return this._heartbeatsCache.lastSentHeartbeatDate=r,a.length>0?(this._heartbeatsCache.heartbeats=a,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),i}catch(r){return fe.warn(r),""}}}function qn(){return new Date().toISOString().substring(0,10)}function oo(e,t=so){const r=[];let s=e.slice();for(const a of e){const i=r.find(o=>o.agent===a.agent);if(i){if(i.dates.push(a.date),Vn(r)>t){i.dates.pop();break}}else if(r.push({agent:a.agent,dates:[a.date]}),Vn(r)>t){r.pop();break}s=s.slice(1)}return{heartbeatsToSend:r,unsentEntries:s}}class lo{constructor(t){this.app=t,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return $r()?Fr().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const r=await ro(this.app);return r!=null&&r.heartbeats?r:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(t){if(await this._canUseIndexedDBPromise){const s=await this.read();return Bn(this.app,{lastSentHeartbeatDate:t.lastSentHeartbeatDate??s.lastSentHeartbeatDate,heartbeats:t.heartbeats})}else return}async add(t){if(await this._canUseIndexedDBPromise){const s=await this.read();return Bn(this.app,{lastSentHeartbeatDate:t.lastSentHeartbeatDate??s.lastSentHeartbeatDate,heartbeats:[...s.heartbeats,...t.heartbeats]})}else return}}function Vn(e){return Or(JSON.stringify({version:2,heartbeats:e})).length}function co(e){if(e.length===0)return-1;let t=0,r=e[0].date;for(let s=1;s<e.length;s++)e[s].date<r&&(r=e[s].date,t=s);return t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function uo(e){Ee(new ve("platform-logger",t=>new ji(t),"PRIVATE")),Ee(new ve("heartbeat",t=>new io(t),"PRIVATE")),ye(Wt,Fn,e),ye(Wt,Fn,"esm2020"),ye("fire-js","")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */uo("");var mo="firebase",ho="13.1.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */ye(mo,ho,"app");const zr="@firebase/installations",mn="0.6.24";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ur=1e4,Wr=`w:${mn}`,Gr="FIS_v2",po="https://firebaseinstallations.googleapis.com/v1",fo=60*60*1e3,xo="installations",go="Installations";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const bo={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},Ce=new dt(xo,go,bo);function Qr(e){return e instanceof Fe&&e.code.includes("request-failed")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Yr({projectId:e}){return`${po}/projects/${e}/installations`}function Jr(e){return{token:e.token,requestStatus:2,expiresIn:vo(e.expiresIn),creationTime:Date.now()}}async function Xr(e,t){const s=(await t.json()).error;return Ce.create("request-failed",{requestName:e,serverCode:s.code,serverMessage:s.message,serverStatus:s.status})}function Zr({apiKey:e}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e})}function yo(e,{refreshToken:t}){const r=Zr(e);return r.append("Authorization",wo(t)),r}async function es(e){const t=await e();return t.status>=500&&t.status<600?e():t}function vo(e){return Number(e.replace("s","000"))}function wo(e){return`${Gr} ${e}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function jo({appConfig:e,heartbeatServiceProvider:t},{fid:r}){const s=Yr(e),a=Zr(e),i=t.getImmediate({optional:!0});if(i){const l=await i.getHeartbeatsHeader();l&&a.append("x-firebase-client",l)}const o={fid:r,authVersion:Gr,appId:e.appId,sdkVersion:Wr},c={method:"POST",headers:a,body:JSON.stringify(o)},d=await es(()=>fetch(s,c));if(d.ok){const l=await d.json();return{fid:l.fid||r,registrationStatus:2,refreshToken:l.refreshToken,authToken:Jr(l.authToken)}}else throw await Xr("Create Installation",d)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ts(e){return new Promise(t=>{setTimeout(t,e)})}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function _o(e){return btoa(String.fromCharCode(...e)).replace(/\+/g,"-").replace(/\//g,"_")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const No=/^[cdef][\w-]{21}$/,Yt="";function ko(){try{const e=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(e),e[0]=112+e[0]%16;const r=So(e);return No.test(r)?r:Yt}catch{return Yt}}function So(e){return _o(e).substr(0,22)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Le(e){return`${e.appName}!${e.appId}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Me=new Map;function ns(e,t){const r=Le(e);rs(r,t),Io(r,t)}function Eo(e,t){ss();const r=Le(e);let s=Me.get(r);s||(s=new Set,Me.set(r,s)),s.add(t)}function Co(e,t){const r=Le(e),s=Me.get(r);s&&(s.delete(t),s.size===0&&Me.delete(r),as())}function rs(e,t){const r=Me.get(e);if(r)for(const s of r)s(t)}function Io(e,t){const r=ss();r&&r.postMessage({key:e,fid:t}),as()}let ke=null;function ss(){return!ke&&"BroadcastChannel"in self&&(ke=new BroadcastChannel("[Firebase] FID Change"),ke.onmessage=e=>{rs(e.data.key,e.data.fid)}),ke}function as(){Me.size===0&&ke&&(ke.close(),ke=null)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const To="firebase-installations-database",Ao=1,Ie="firebase-installations-store";let It=null;function hn(){return It||(It=ut(To,Ao,{upgrade:(e,t)=>{switch(t){case 0:e.createObjectStore(Ie)}}})),It}async function st(e,t){const r=Le(e),a=(await hn()).transaction(Ie,"readwrite"),i=a.objectStore(Ie),o=await i.get(r);return await i.put(t,r),await a.done,(!o||o.fid!==t.fid)&&ns(e,t.fid),t}async function is(e){const t=Le(e),s=(await hn()).transaction(Ie,"readwrite");await s.objectStore(Ie).delete(t),await s.done}async function mt(e,t){const r=Le(e),a=(await hn()).transaction(Ie,"readwrite"),i=a.objectStore(Ie),o=await i.get(r),c=t(o);return c===void 0?await i.delete(r):await i.put(c,r),await a.done,c&&(!o||o.fid!==c.fid)&&ns(e,c.fid),c}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function pn(e){let t;const r=await mt(e.appConfig,s=>{const a=Do(s),i=Ro(e,a);return t=i.registrationPromise,i.installationEntry});return r.fid===Yt?{installationEntry:await t}:{installationEntry:r,registrationPromise:t}}function Do(e){const t=e||{fid:ko(),registrationStatus:0};return os(t)}function Ro(e,t){if(t.registrationStatus===0){if(!navigator.onLine){const a=Promise.reject(Ce.create("app-offline"));return{installationEntry:t,registrationPromise:a}}const r={fid:t.fid,registrationStatus:1,registrationTime:Date.now()},s=Po(e,r);return{installationEntry:r,registrationPromise:s}}else return t.registrationStatus===1?{installationEntry:t,registrationPromise:Oo(e)}:{installationEntry:t}}async function Po(e,t){try{const r=await jo(e,t);return st(e.appConfig,r)}catch(r){throw Qr(r)&&r.customData.serverCode===409?await is(e.appConfig):await st(e.appConfig,{fid:t.fid,registrationStatus:0}),r}}async function Oo(e){let t=await Hn(e.appConfig);for(;t.registrationStatus===1;)await ts(100),t=await Hn(e.appConfig);if(t.registrationStatus===0){const{installationEntry:r,registrationPromise:s}=await pn(e);return s||r}return t}function Hn(e){return mt(e,t=>{if(!t)throw Ce.create("installation-not-found");return os(t)})}function os(e){return Mo(e)?{fid:e.fid,registrationStatus:0}:e}function Mo(e){return e.registrationStatus===1&&e.registrationTime+Ur<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function $o({appConfig:e,heartbeatServiceProvider:t},r){const s=Fo(e,r),a=yo(e,r),i=t.getImmediate({optional:!0});if(i){const l=await i.getHeartbeatsHeader();l&&a.append("x-firebase-client",l)}const o={installation:{sdkVersion:Wr,appId:e.appId}},c={method:"POST",headers:a,body:JSON.stringify(o)},d=await es(()=>fetch(s,c));if(d.ok){const l=await d.json();return Jr(l)}else throw await Xr("Generate Auth Token",d)}function Fo(e,{fid:t}){return`${Yr(e)}/${t}/authTokens:generate`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function fn(e,t=!1){let r;const s=await mt(e.appConfig,i=>{if(!ls(i))throw Ce.create("not-registered");const o=i.authToken;if(!t&&qo(o))return i;if(o.requestStatus===1)return r=Lo(e,t),i;{if(!navigator.onLine)throw Ce.create("app-offline");const c=Ho(i);return r=Bo(e,c),c}});return r?await r:s.authToken}async function Lo(e,t){let r=await Kn(e.appConfig);for(;r.authToken.requestStatus===1;)await ts(100),r=await Kn(e.appConfig);const s=r.authToken;return s.requestStatus===0?fn(e,t):s}function Kn(e){return mt(e,t=>{if(!ls(t))throw Ce.create("not-registered");const r=t.authToken;return Ko(r)?{...t,authToken:{requestStatus:0}}:t})}async function Bo(e,t){try{const r=await $o(e,t),s={...t,authToken:r};return await st(e.appConfig,s),r}catch(r){if(Qr(r)&&(r.customData.serverCode===401||r.customData.serverCode===404))await is(e.appConfig);else{const s={...t,authToken:{requestStatus:0}};await st(e.appConfig,s)}throw r}}function ls(e){return e!==void 0&&e.registrationStatus===2}function qo(e){return e.requestStatus===2&&!Vo(e)}function Vo(e){const t=Date.now();return t<e.creationTime||e.creationTime+e.expiresIn<t+fo}function Ho(e){const t={requestStatus:1,requestTime:Date.now()};return{...e,authToken:t}}function Ko(e){return e.requestStatus===1&&e.requestTime+Ur<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function zo(e){const t=e,{installationEntry:r,registrationPromise:s}=await pn(t);return s?s.catch(console.error):fn(t).catch(console.error),r.fid}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Uo(e,t=!1){const r=e;return await Wo(r),(await fn(r,t)).token}async function Wo(e){const{registrationPromise:t}=await pn(e);t&&await t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Go(e,t){const{appConfig:r}=e;return Eo(r,t),()=>{Co(r,t)}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Qo(e){if(!e||!e.options)throw Tt("App Configuration");if(!e.name)throw Tt("App Name");const t=["projectId","apiKey","appId"];for(const r of t)if(!e.options[r])throw Tt(r);return{appName:e.name,projectId:e.options.projectId,apiKey:e.options.apiKey,appId:e.options.appId}}function Tt(e){return Ce.create("missing-app-config-values",{valueName:e})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cs="installations",Yo="installations-internal",Jo=e=>{const t=e.getProvider("app").getImmediate(),r=Qo(t),s=un(t,"heartbeat");return{app:t,appConfig:r,heartbeatServiceProvider:s,_delete:()=>Promise.resolve()}},Xo=e=>{const t=e.getProvider("app").getImmediate(),r=un(t,cs).getImmediate();return{getId:()=>zo(r),getToken:a=>Uo(r,a)}};function Zo(){Ee(new ve(cs,Jo,"PUBLIC")),Ee(new ve(Yo,Xo,"PRIVATE"))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Zo();ye(zr,mn);ye(zr,mn,"esm2020");/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const el="/firebase-messaging-sw.js",tl="/firebase-cloud-messaging-push-scope",ds="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",nl="https://fcmregistrations.googleapis.com/v1",us="google.c.a.c_id",rl="google.c.a.c_l",sl="google.c.a.ts",al="google.c.a.e",zn=1e4;var Un;(function(e){e[e.DATA_MESSAGE=1]="DATA_MESSAGE",e[e.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(Un||(Un={}));/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */var $e;(function(e){e.PUSH_RECEIVED="push-received",e.NOTIFICATION_CLICKED="notification-clicked",e.FID_REGISTERED="fid-registered"})($e||($e={}));/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function re(e){const t=new Uint8Array(e);return btoa(String.fromCharCode(...t)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function ms(e){const t="=".repeat((4-e.length%4)%4),r=(e+t).replace(/\-/g,"+").replace(/_/g,"/"),s=atob(r),a=new Uint8Array(s.length);for(let i=0;i<s.length;++i)a[i]=s.charCodeAt(i);return a}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const At="fcm_token_details_db",il=5,Wn="fcm_token_object_Store";async function ol(e){if("databases"in indexedDB&&!(await indexedDB.databases()).map(i=>i.name).includes(At))return null;let t=null;return(await ut(At,il,{upgrade:async(s,a,i,o)=>{if(a<2||!s.objectStoreNames.contains(Wn))return;const c=o.objectStore(Wn),d=await c.index("fcmSenderId").get(e);if(await c.clear(),!!d){if(a===2){const l=d;if(!l.auth||!l.p256dh||!l.endpoint)return;t={token:l.fcmToken,createTime:l.createTime??Date.now(),subscriptionOptions:{auth:l.auth,p256dh:l.p256dh,endpoint:l.endpoint,swScope:l.swScope,vapidKey:typeof l.vapidKey=="string"?l.vapidKey:re(l.vapidKey)}}}else if(a===3){const l=d;t={token:l.fcmToken,createTime:l.createTime,subscriptionOptions:{auth:re(l.auth),p256dh:re(l.p256dh),endpoint:l.endpoint,swScope:l.swScope,vapidKey:re(l.vapidKey)}}}else if(a===4){const l=d;t={token:l.fcmToken,createTime:l.createTime,subscriptionOptions:{auth:re(l.auth),p256dh:re(l.p256dh),endpoint:l.endpoint,swScope:l.swScope,vapidKey:re(l.vapidKey)}}}}}})).close(),await rt(At),await rt("fcm_vapid_details_db"),await rt("undefined"),ll(t)?t:null}function ll(e){if(!e||!e.subscriptionOptions)return!1;const{subscriptionOptions:t}=e;return typeof e.createTime=="number"&&e.createTime>0&&typeof e.token=="string"&&e.token.length>0&&typeof t.auth=="string"&&t.auth.length>0&&typeof t.p256dh=="string"&&t.p256dh.length>0&&typeof t.endpoint=="string"&&t.endpoint.length>0&&typeof t.swScope=="string"&&t.swScope.length>0&&typeof t.vapidKey=="string"&&t.vapidKey.length>0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cl={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","fid-registration-failed":"A problem occurred while creating an FCM registration via FID: {$errorInfo}","fid-unregister-failed":"A problem occurred while unregistering the FCM registration via FID: {$errorInfo}","fid-registration-idb-schema-unavailable":"Unable to read or persist FID registration metadata because the messaging IndexedDB schema is unavailable (for example, the database could not be upgraded to the latest version).","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used.","invalid-on-registered-handler":"No onRegistered callback handler was provided or registered. Implement onRegistered() before register()."},P=new dt("messaging","Messaging",cl);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Gn="firebase-messaging-database",Qn=2,Te="firebase-messaging-store",he="firebase-messaging-fid-registration-store",dl={openDB:ut,deleteDB:rt};let Yn=dl,ze=null;function ul(e,t,r){switch(t){case 0:if(e.createObjectStore(Te),r===1)break;case 1:r===2&&e.createObjectStore(he)}}function Jn(e){return{upgrade:(t,r)=>{ul(t,r,e)},blocked:()=>{},blocking:(t,r,s)=>{var a;ze=null,(a=s.target)==null||a.close()},terminated:()=>{ze=null}}}function ht(){return ze||(ze=Yn.openDB(Gn,Qn,Jn(2)).catch(()=>Yn.openDB(Gn,Qn-1,Jn(1)))),ze}function hs(e,t){return e.objectStoreNames.contains(t)}function ps(e){if(!hs(e,he))throw P.create("fid-registration-idb-schema-unavailable")}async function ml(e){const t=pt(e),s=await(await ht()).transaction(Te).objectStore(Te).get(t);if(s)return s;{const a=await ol(e.appConfig.senderId);if(a)return await xn(e,a),a}}async function xn(e,t){const r=pt(e),s=await ht(),a=[Te],i=hs(s,he);i&&a.push(he);const o=s.transaction(a,"readwrite");return await o.objectStore(Te).put(t,r),i&&await o.objectStore(he).delete(r),await o.done,t}async function fs(e){const t=pt(e),r=await ht();return ps(r),await r.transaction(he).objectStore(he).get(t)}async function hl(e,t){const r=pt(e),s=await ht();ps(s);const a=s.transaction([Te,he],"readwrite");return await a.objectStore(he).put(t,r),await a.objectStore(Te).delete(r),await a.done,t}function pt({appConfig:e}){return e.appId}const Xn="@firebase/messaging",Jt="0.13.3";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const pl=3,fl=1e3;async function xl(e,t){const r=await xt(e),s=gn(t,e.appConfig.appName,!1),a={method:"POST",headers:r,body:JSON.stringify(s)};let i;try{i=await(await fetch(ft(e.appConfig),a)).json()}catch(o){throw P.create("token-subscribe-failed",{errorInfo:o==null?void 0:o.toString()})}if(i.error){const o=i.error.message;throw P.create("token-subscribe-failed",{errorInfo:o})}if(!i.token)throw P.create("token-subscribe-no-token");return i.token}async function gl(e,t){var d;const r=await xt(e),s=gn(t,e.appConfig.appName,!0),a={method:"POST",headers:r,body:JSON.stringify(s)};let i;try{i=await jl(()=>fetch(ft(e.appConfig),a),pl,fl)}catch(l){throw P.create("fid-registration-failed",{errorInfo:l==null?void 0:l.toString()})}if(i.ok)return{responseFid:await bl(i)};let o;try{o=await i.json()}catch{throw P.create("fid-registration-failed",{errorInfo:i.statusText})}const c=((d=o.error)==null?void 0:d.message)??i.statusText;throw P.create("fid-registration-failed",{errorInfo:c})}async function bl(e){const t=await e.text();if(!t.trim())throw P.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response body is empty"});let r;try{r=JSON.parse(t)}catch{throw P.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response body is not valid JSON"})}const s=r.name;if(typeof s!="string"||s.length===0)throw P.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response did not include a non-empty name"});return yl(s)}const Zn="/registrations/";function yl(e){const t=e.indexOf(Zn);if(t!==-1){const r=e.slice(t+Zn.length);if(r.length>0)return r}throw P.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response name is not a valid registration resource name"})}async function vl(e,t){const r=await xt(e),s=gn(t.subscriptionOptions,e.appConfig.appName,!1),a={method:"PATCH",headers:r,body:JSON.stringify(s)};let i;try{i=await(await fetch(`${ft(e.appConfig)}/${t.token}`,a)).json()}catch(o){throw P.create("token-update-failed",{errorInfo:o==null?void 0:o.toString()})}if(i.error){const o=i.error.message;throw P.create("token-update-failed",{errorInfo:o})}if(!i.token)throw P.create("token-update-no-token");return i.token}async function wl(e,t){const s={method:"DELETE",headers:await xt(e)};try{const i=await(await fetch(`${ft(e.appConfig)}/${t}`,s)).json();if(i.error){const o=i.error.message;throw P.create("token-unsubscribe-failed",{errorInfo:o})}}catch(a){throw P.create("token-unsubscribe-failed",{errorInfo:a==null?void 0:a.toString()})}}async function jl(e,t,r){let s;for(let a=0;a<t;a++)try{return await e()}catch(i){if(s=i,a<t-1){const o=r*Math.pow(2,a);await new Promise(c=>setTimeout(c,o))}}throw s}function ft({projectId:e}){return`${nl}/projects/${e}/registrations`}async function xt({appConfig:e,installations:t}){const r=await t.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e.apiKey,"x-goog-firebase-installations-auth":`FIS ${r}`})}function _l(e,t){var r,s;try{if(/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(e))return new URL(e).host}catch{}try{if(typeof self<"u"&&((r=self.location)!=null&&r.href))return new URL(e,self.location.origin).host}catch{}return typeof self<"u"&&((s=self.location)!=null&&s.host)?self.location.host:t}function gn({p256dh:e,auth:t,endpoint:r,vapidKey:s,swScope:a},i,o){const c={web:{origin:_l(a,i),endpoint:r,auth:t,p256dh:e}};return o&&(c.fcm_sdk_version=Jt),s!==ds&&(c.web.applicationPubKey=s),c}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Nl=7*24*60*60*1e3;async function kl(e){const t=await El(e.swRegistration,e.vapidKey),r={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:t.endpoint,auth:re(t.getKey("auth")),p256dh:re(t.getKey("p256dh"))},s=await ml(e.firebaseDependencies);if(s){if(Cl(s.subscriptionOptions,r))return Date.now()>=s.createTime+Nl?Sl(e,{token:s.token,createTime:Date.now(),subscriptionOptions:r}):s.token;try{await wl(e.firebaseDependencies,s.token)}catch(a){console.warn(a)}return er(e.firebaseDependencies,r)}else return er(e.firebaseDependencies,r)}async function Sl(e,t){try{const r=await vl(e.firebaseDependencies,t),s={...t,token:r,createTime:Date.now()};return await xn(e.firebaseDependencies,s),r}catch(r){throw r}}async function er(e,t){const s={token:await xl(e,t),createTime:Date.now(),subscriptionOptions:t};return await xn(e,s),s.token}async function El(e,t){const r=await e.pushManager.getSubscription();return r||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:ms(t)})}function Cl(e,t){const r=t.vapidKey===e.vapidKey,s=t.endpoint===e.endpoint,a=t.auth===e.auth,i=t.p256dh===e.p256dh;return r&&s&&a&&i}function Il(e,t){const r=e.onRegisteredHandler;r&&(typeof r=="function"?r(t):r.next(t))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Tl(e){try{e.swRegistration=await navigator.serviceWorker.register(el,{scope:tl}),e.swRegistration.update().catch(()=>{}),await Al(e.swRegistration)}catch(t){throw P.create("failed-service-worker-registration",{browserErrorMessage:t==null?void 0:t.message})}}async function Al(e){return new Promise((t,r)=>{const s=setTimeout(()=>r(new Error(`Service worker not registered after ${zn} ms`)),zn),a=e.installing||e.waiting;e.active?(clearTimeout(s),t()):a?a.onstatechange=i=>{var o;((o=i.target)==null?void 0:o.state)==="activated"&&(a.onstatechange=null,clearTimeout(s),t())}:(clearTimeout(s),r(new Error("No incoming service worker found.")))})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function xs(e,t){if(!t&&!e.swRegistration&&await Tl(e),!(!t&&e.swRegistration)){if(!(t instanceof ServiceWorkerRegistration))throw P.create("invalid-sw-registration");e.swRegistration=t}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function gs(e,t){t?e.vapidKey=t:e.vapidKey||(e.vapidKey=ds)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const tr=3;async function Dl(e,t){const r=await Rl(e.swRegistration,e.vapidKey),s={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:r.endpoint,auth:re(r.getKey("auth")),p256dh:re(r.getKey("p256dh"))},a=e.firebaseDependencies.installations;for(let i=0;i<tr;i++){const{responseFid:o}=await gl(e.firebaseDependencies,s);if(o===t)return;i<tr-1&&await a.getToken(!0)}throw P.create("fid-registration-failed",{errorInfo:"CreateRegistration response FID does not match Firebase Installation ID"})}async function Rl(e,t){const r=await e.pushManager.getSubscription();return r||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:ms(t)})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Pl=7*24*60*60*1e3;async function bs(e,t){if(!navigator)throw P.create("only-available-in-window");if(Notification.permission==="default"&&await Notification.requestPermission(),Notification.permission!=="granted")throw P.create("permission-blocked");if(!e.onRegisteredHandler)throw P.create("invalid-on-registered-handler");await gs(e,t==null?void 0:t.vapidKey),await xs(e,t==null?void 0:t.serviceWorkerRegistration);const r=e._registerNotifyChain.catch(()=>{});return e._registerNotifyChain=r.then(async()=>{const s=await e.firebaseDependencies.installations.getId(),a=await fs(e.firebaseDependencies),i=Date.now();if((!a||a.fid!==s||i>=a.lastRegisterTime+Pl)&&(await Dl(e,s),await hl(e.firebaseDependencies,{fid:s,lastRegisterTime:i,vapidKey:e.vapidKey})),!e.onRegisteredHandler)throw P.create("invalid-on-registered-handler");Il(e,s)}),e._registerNotifyChain}/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ol(e,t){return Go(t,()=>{(async()=>!e.onRegisteredHandler||!await fs(e.firebaseDependencies)||await bs(e).catch(()=>{}))()})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function nr(e){const t={from:e.from,collapseKey:e.collapse_key,messageId:e.fcmMessageId};return Ml(t,e),$l(t,e),Fl(t,e),t}function Ml(e,t){if(!t.notification)return;e.notification={};const r=t.notification.title;r&&(e.notification.title=r);const s=t.notification.body;s&&(e.notification.body=s);const a=t.notification.image;a&&(e.notification.image=a);const i=t.notification.icon;i&&(e.notification.icon=i)}function $l(e,t){t.data&&(e.data=t.data)}function Fl(e,t){var a,i,o,c;if(!t.fcmOptions&&!((a=t.notification)!=null&&a.click_action))return;e.fcmOptions={};const r=((i=t.fcmOptions)==null?void 0:i.link)??((o=t.notification)==null?void 0:o.click_action);r&&(e.fcmOptions.link=r);const s=(c=t.fcmOptions)==null?void 0:c.analytics_label;s&&(e.fcmOptions.analyticsLabel=s)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ll(e){return typeof e=="object"&&!!e&&us in e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Bl(e){if(!e||!e.options)throw Dt("App Configuration Object");if(!e.name)throw Dt("App Name");const t=["projectId","apiKey","appId","messagingSenderId"],{options:r}=e;for(const s of t)if(!r[s])throw Dt(s);return{appName:e.name,projectId:r.projectId,apiKey:r.apiKey,appId:r.appId,senderId:r.messagingSenderId}}function Dt(e){return P.create("missing-app-config-values",{valueName:e})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ql{constructor(t,r,s){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.onRegisteredHandler=null,this.onUnregisteredHandler=null,this._registerNotifyChain=Promise.resolve(),this._fidChangeUnsubscribe=null,this.logEvents=[],this.logQueue={state:"stopped"};const a=Bl(t);this.firebaseDependencies={app:t,appConfig:a,installations:r,analyticsProvider:s}}_delete(){return this._fidChangeUnsubscribe&&(this._fidChangeUnsubscribe(),this._fidChangeUnsubscribe=null),this.logQueue.state==="scheduled"&&clearTimeout(this.logQueue.timerId),this.logQueue={state:"stopped"},Promise.resolve()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ys(e,t){if(!navigator)throw P.create("only-available-in-window");if(Notification.permission==="default"&&await Notification.requestPermission(),Notification.permission!=="granted")throw P.create("permission-blocked");return await gs(e,t==null?void 0:t.vapidKey),await xs(e,t==null?void 0:t.serviceWorkerRegistration),kl(e)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Vl(e,t,r){const s=Hl(t);(await e.firebaseDependencies.analyticsProvider.get()).logEvent(s,{message_id:r[us],message_name:r[rl],message_time:r[sl],message_device_time:Math.floor(Date.now()/1e3)})}function Hl(e){switch(e){case $e.NOTIFICATION_CLICKED:return"notification_open";case $e.PUSH_RECEIVED:return"notification_foreground";default:throw new Error}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Kl(e,t){const r=t.data;if(!r.isFirebaseMessaging)return;if(e.onMessageHandler&&r.messageType===$e.PUSH_RECEIVED&&(typeof e.onMessageHandler=="function"?e.onMessageHandler(nr(r)):e.onMessageHandler.next(nr(r))),e.onRegisteredHandler&&r.messageType===$e.FID_REGISTERED){const a=r.fid;typeof e.onRegisteredHandler=="function"?e.onRegisteredHandler(a):e.onRegisteredHandler.next(a)}const s=r.data;Ll(s)&&s[al]==="1"&&await Vl(e,r.messageType,s)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const zl=e=>{const t=new ql(e.getProvider("app").getImmediate(),e.getProvider("installations-internal").getImmediate(),e.getProvider("analytics-internal"));return navigator.serviceWorker.addEventListener("message",r=>Kl(t,r)),t._fidChangeUnsubscribe=Ol(t,e.getProvider("installations").getImmediate()),t},Ul=e=>{const t=e.getProvider("messaging").getImmediate();return{getToken:s=>ys(t,s),register:s=>bs(t,s)}};function Wl(){Ee(new ve("messaging",zl,"PUBLIC")),Ee(new ve("messaging-internal",Ul,"PRIVATE")),ye(Xn,Jt),ye(Xn,Jt,"esm2020")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function vs(){try{await Fr()}catch{return!1}return typeof window<"u"&&$r()&&ei()&&"serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window&&"fetch"in window&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Gl(e,t){if(!navigator)throw P.create("only-available-in-window");return e.onMessageHandler=t,()=>{e.onMessageHandler=null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ql(e=Vr()){return vs().then(t=>{if(!t)throw P.create("unsupported-browser")},t=>{throw P.create("indexed-db-unsupported")}),un(cn(e),"messaging").getImmediate()}async function Yl(e,t){return e=cn(e),ys(e,t)}function Jl(e,t){return e=cn(e),Gl(e,t)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Wl();let Rt=null,Pt=null;async function Xl(e){if(!(e!=null&&e.apiKey)||!(e!=null&&e.projectId)||!(e!=null&&e.appId))return null;try{return eo().length?Rt=Vr():Rt=qr({apiKey:e.apiKey,authDomain:e.authDomain||`${e.projectId}.firebaseapp.com`,projectId:e.projectId,storageBucket:e.storageBucket||`${e.projectId}.appspot.com`,messagingSenderId:e.messagingSenderId,appId:e.appId}),Rt}catch(t){return console.error("firebase init error",t),null}}async function Zl(e){try{return await vs()?(Pt||(Pt=Ql(e)),Pt):null}catch(t){return console.error("firebase messaging error",t),null}}async function ec(e,t){try{return await Notification.requestPermission()!=="granted"?null:await Yl(e,t?{vapidKey:t}:void 0)||null}catch(r){return console.error("fcm token error",r),null}}function tc(e,t){try{return Jl(e,t)}catch(r){return console.error("onMessage error",r),()=>{}}}async function nc(e,t){var r;try{if(typeof window>"u"||!(e!=null&&e.enabled)||!((r=e==null?void 0:e.firebase)!=null&&r.apiKey))return null;if("serviceWorker"in navigator)try{await navigator.serviceWorker.register("/firebase-messaging-sw.js")}catch{}const s=await Xl(e.firebase);if(!s)return null;const a=await Zl(s);if(!a)return null;const i=await ec(a,e.firebase.vapidKey||void 0);if(i)try{await w("/push-tokens",{method:"POST",body:{token:i,platform:"web",app_id:"partner_web",device_type:navigator.userAgent}})}catch{}return tc(a,o=>{var c,d,l,h;try{const m=((c=o==null?void 0:o.notification)==null?void 0:c.title)||((d=o==null?void 0:o.data)==null?void 0:d.title)||"Notification",u=((l=o==null?void 0:o.notification)==null?void 0:l.body)||((h=o==null?void 0:o.data)==null?void 0:h.body)||"";Notification.permission==="granted"&&new Notification(m,{body:u,data:o==null?void 0:o.data})}catch{}}),i}catch(s){return console.error("push init error",s),null}}function rc(){var C;const{user:e,role:t,profile:r,logout:s}=R(),a=it(),[i,o]=p.useState(!1),[c,d]=p.useState(!1);p.useEffect(()=>{(async()=>{try{const x=await w("/app-config");x!=null&&x.push&&nc(x.push,(e==null?void 0:e.id)||(r==null?void 0:r.id))}catch{}})()},[e==null?void 0:e.id,r==null?void 0:r.id]);const l={driver:{label:"Driver · Rides",brand:"p-driver",icon:ce},delivery_partner:{label:"Delivery Partner",brand:"p-delivery",icon:le}},h=l[t]??l.driver,m=h.icon,u=new Set(((e==null?void 0:e.roles)??[]).map(x=>x.slug)),f=u.has("driver")&&u.has("delivery_partner"),j=[{label:"Working",items:[{to:"/",label:"Dashboard",icon:va,end:!0},{to:"/requests",label:"Incoming jobs",icon:ma}]},{label:"Money",items:[{to:"/earnings",label:"Earnings & Wallet",icon:lt}]},{label:"Account",items:[{to:"/profile",label:"Profile & KYC",icon:Na}]}],I=async()=>{d(!1),await s(),a("/login",{replace:!0})},b=async()=>{d(!1),await R.getState().switchRole(),a("/")},$=({onNavigate:x})=>n.jsx("nav",{className:"flex-1 space-y-6 overflow-y-auto py-5",children:j.map(O=>n.jsxs("div",{children:[n.jsx("p",{className:"px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400",children:O.label}),n.jsx("div",{className:"space-y-1 px-3",children:O.items.map(v=>n.jsxs(Bs,{to:v.to,end:v.end,onClick:x,className:({isActive:M})=>J("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",M?"bg-brand-600/10 text-brand-700":"text-neutral-600 hover:bg-ink-50 hover:text-neutral-900"),children:[n.jsx(v.icon,{className:"h-4.5 w-4.5"}),v.label]},v.to))})]},O.label))}),D=n.jsxs("span",{className:J("hidden items-center gap-2 text-xs text-neutral-400 sm:flex"),children:[n.jsx("span",{className:J("h-2 w-2 rounded-full",r!=null&&r.is_online?"bg-emerald-500":"bg-neutral-300")}),r!=null&&r.is_busy?"On a job":r!=null&&r.is_online?"Online":"Offline"]});return n.jsxs("div",{className:J("flex min-h-dvh bg-ink-50",h.brand),children:[n.jsx(Va,{}),n.jsxs("aside",{className:"fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-100 bg-white lg:flex",children:[n.jsxs("div",{className:"flex items-center gap-3 border-b border-ink-100 px-5 py-4",children:[n.jsx("div",{className:"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white",children:n.jsx(m,{className:"h-5 w-5"})}),n.jsxs("div",{className:"min-w-0",children:[n.jsx("p",{className:"truncate text-sm font-bold text-neutral-900",children:(e==null?void 0:e.name)??"Partner Hub"}),n.jsx("p",{className:"truncate text-xs text-neutral-400",children:h.label})]})]}),n.jsx($,{}),n.jsx("div",{className:"border-t border-ink-100 p-2",children:n.jsxs("div",{className:"relative",children:[n.jsxs("button",{onClick:()=>d(x=>!x),className:"flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-ink-50",children:[n.jsx("div",{className:"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white",children:((C=e==null?void 0:e.name)==null?void 0:C.charAt(0))??"P"}),n.jsxs("div",{className:"min-w-0 flex-1 text-left",children:[n.jsx("p",{className:"truncate text-sm font-semibold text-neutral-800",children:r?`#${r.id}`:"—"}),n.jsx("p",{className:"truncate text-xs text-neutral-400",children:h.label})]}),n.jsx(Ir,{className:J("h-4 w-4 text-neutral-400 transition-transform",c&&"rotate-180")})]}),c&&n.jsxs(n.Fragment,{children:[n.jsx("div",{className:"fixed inset-0 z-[40]",onClick:()=>d(!1)}),n.jsxs("div",{className:"absolute bottom-full left-0 z-[41] mb-2 w-full rounded-xl border border-ink-100 bg-white p-1.5 shadow-card",children:[n.jsxs("div",{className:"mb-1 rounded-lg bg-ink-50 px-3 py-2",children:[n.jsx("p",{className:"text-xs text-neutral-400",children:"Current role"}),n.jsx("p",{className:"text-sm font-semibold capitalize text-neutral-800",children:h.label})]}),f&&n.jsxs(E,{variant:"outline",size:"sm",className:"mb-1 w-full justify-start",onClick:b,children:["Switch to ",t==="driver"?"delivery":"driver"," role"]}),n.jsxs(E,{variant:"ghost",size:"sm",className:"w-full justify-start text-red-600",onClick:I,children:[n.jsx(Vt,{className:"h-4 w-4"})," Sign out"]})]})]})]})})]}),i&&n.jsxs("div",{className:"fixed inset-0 z-40 lg:hidden",children:[n.jsx("div",{className:"absolute inset-0 bg-black/40",onClick:()=>o(!1)}),n.jsxs("aside",{className:"absolute inset-y-0 left-0 flex w-72 flex-col bg-white",children:[n.jsxs("div",{className:"flex items-center justify-between border-b border-ink-100 px-5 py-4",children:[n.jsxs("div",{className:"flex items-center gap-3",children:[n.jsx("div",{className:"flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white",children:n.jsx(m,{className:"h-5 w-5"})}),n.jsxs("div",{children:[n.jsx("p",{className:"text-sm font-bold text-neutral-900",children:(e==null?void 0:e.name)??"Partner Hub"}),n.jsx("p",{className:"text-xs text-neutral-400",children:h.label})]})]}),n.jsx("button",{onClick:()=>o(!1),className:"text-neutral-500",children:n.jsx(sn,{className:"h-5 w-5"})})]}),n.jsx($,{onNavigate:()=>o(!1)}),n.jsxs("div",{className:"border-t border-ink-100 p-2",children:[f&&n.jsx(E,{variant:"outline",size:"sm",className:"mb-1 w-full justify-start",onClick:b,children:"Switch role"}),n.jsxs(E,{variant:"ghost",size:"sm",className:"w-full justify-start text-red-600",onClick:I,children:[n.jsx(Vt,{className:"h-4 w-4"})," Sign out"]})]})]})]}),n.jsxs("div",{className:"flex min-w-0 flex-1 flex-col lg:pl-60",children:[n.jsxs("header",{className:"sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-100 bg-white/80 px-4 backdrop-blur sm:px-6",children:[n.jsx("button",{className:"rounded-lg p-2 text-neutral-600 hover:bg-ink-50 lg:hidden",onClick:()=>o(!0),children:n.jsx(wa,{className:"h-5 w-5"})}),n.jsxs(ot,{to:"/",className:"flex items-center gap-2 text-sm font-bold text-neutral-900 lg:hidden",children:[n.jsx("span",{className:"flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white",children:n.jsx(m,{className:"h-4 w-4"})}),h.label]}),n.jsx("div",{className:"ml-auto",children:D})]}),n.jsx("main",{className:"mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6",children:n.jsx(en,{})})]})]})}const S=p.forwardRef(({className:e="",...t},r)=>n.jsx("input",{ref:r,className:`h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-ink-50 ${e}`,...t}));S.displayName="Input";const sc=p.forwardRef(({className:e="",...t},r)=>n.jsx("textarea",{ref:r,className:`w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${e}`,...t}));sc.displayName="Textarea";const Se=p.forwardRef(({className:e="",children:t,...r},s)=>n.jsx("select",{ref:s,className:`h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${e}`,...r,children:t}));Se.displayName="Select";const _=p.forwardRef(({label:e,hint:t,required:r,htmlFor:s,className:a="",children:i,...o},c)=>n.jsxs("label",{ref:c,htmlFor:s,className:`block ${a}`,...o,children:[n.jsxs("span",{className:"mb-1.5 block text-sm font-medium text-neutral-700",children:[e,r&&n.jsx("span",{className:"ml-0.5 text-red-500",children:"*"})]}),i,t&&n.jsx("span",{className:"mt-1.5 block text-xs text-neutral-400",children:t})]}));_.displayName="Field";function ac(){const e=it(),t=gr(),[r,s]=p.useState(""),[a,i]=p.useState(""),[o,c]=p.useState(!1),d=async l=>{var h;if(l.preventDefault(),!(!r||!a)){c(!0);try{await R.getState().login(r.trim(),a),y("Welcome back"),e(((h=t.state)==null?void 0:h.from)??"/",{replace:!0})}catch(m){y(m instanceof Error?m.message:"Login failed","error")}finally{c(!1)}}};return n.jsx("div",{className:"flex min-h-dvh items-center justify-center bg-ink-50 px-4 py-10",children:n.jsxs("div",{className:"w-full max-w-md",children:[n.jsxs("div",{className:"mb-6 text-center",children:[n.jsx("div",{className:"mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white",children:n.jsx(ce,{className:"h-7 w-7"})}),n.jsx("h1",{className:"text-2xl font-black text-neutral-900",children:"Partner Hub"}),n.jsx("p",{className:"mt-1 text-sm text-neutral-500",children:"Sign in as a Driver or Delivery Partner"})]}),n.jsxs("div",{className:"mb-6 grid grid-cols-2 gap-3",children:[n.jsxs("div",{className:"rounded-xl border border-ink-100 bg-white p-3 text-center",children:[n.jsx(ce,{className:"mx-auto mb-1 h-5 w-5 text-brand-600"}),n.jsx("p",{className:"text-xs font-semibold text-neutral-800",children:"Rides & trips"}),n.jsx("p",{className:"text-[11px] text-neutral-400",children:"driver role"})]}),n.jsxs("div",{className:"rounded-xl border border-ink-100 bg-white p-3 text-center",children:[n.jsx(le,{className:"mx-auto mb-1 h-5 w-5 text-brand-600"}),n.jsx("p",{className:"text-xs font-semibold text-neutral-800",children:"Food & grocery"}),n.jsx("p",{className:"text-[11px] text-neutral-400",children:"delivery partner role"})]})]}),n.jsxs("form",{onSubmit:d,className:"space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card",children:[n.jsx(_,{label:"Email",children:n.jsx(S,{type:"email",autoComplete:"email",placeholder:"you@company.com",value:r,onChange:l=>s(l.target.value)})}),n.jsx(_,{label:"Password",children:n.jsx(S,{type:"password",autoComplete:"current-password",placeholder:"••••••••",value:a,onChange:l=>i(l.target.value)})}),n.jsxs(E,{type:"submit",className:"w-full",disabled:o,children:[o?"Signing in…":"Sign in",!o&&n.jsx(Er,{className:"h-4 w-4"})]}),n.jsx(ot,{to:"/register",className:"block text-center text-sm font-semibold text-brand-600 hover:text-brand-700",children:"Want to become a partner? Apply here"}),n.jsxs("p",{className:"text-center text-[11px] leading-relaxed text-neutral-400",children:["Demo accounts — driver@superapp.com / partner@superapp.com (password).",n.jsx("br",{}),"One account holding both roles can switch between panels."]})]})]})})}const ic={role:"delivery_partner",name:"",email:"",phone:"",password:"",country_code:"+91",service_type:"food",zone_id:null,vehicle_number:"",vehicle_model:"",vehicle_color:"",license_number:"",license_expiry:"",aadhar_number:"",pan_number:"",bank_account_name:"",bank_account_number:"",bank_ifsc:"",bank_name:""};function oc(){const e=it(),[t,r]=p.useState(ic),[s,a]=p.useState([]),[i,o]=p.useState([]),[c,d]=p.useState(!1);p.useEffect(()=>{jr.list().then(a).catch(()=>{})},[]),p.useEffect(()=>{Zs.list().then(o).catch(()=>{})},[]);const l=(u,f)=>r(j=>({...j,[u]:f})),h=t.role,m=async u=>{u.preventDefault(),d(!0);try{await nn.register(t),y("Application submitted. We will review your profile shortly."),e("/login")}catch(f){y(f instanceof Error?f.message:"Registration failed","error")}finally{d(!1)}};return n.jsx("div",{className:"min-h-dvh bg-ink-50 px-4 py-10",children:n.jsxs("div",{className:"mx-auto w-full max-w-2xl",children:[n.jsxs("div",{className:"mb-6 text-center",children:[n.jsx("div",{className:"mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white",children:h==="driver"?n.jsx(ce,{className:"h-7 w-7"}):n.jsx(le,{className:"h-7 w-7"})}),n.jsx("h1",{className:"text-2xl font-black text-neutral-900",children:"Become a partner"}),n.jsx("p",{className:"mt-1 text-sm text-neutral-500",children:"Apply as a driver or delivery partner — review takes under 24h."})]}),n.jsx("div",{className:"mb-6 grid grid-cols-2 gap-3",children:["delivery_partner","driver"].map(u=>n.jsxs("button",{type:"button",onClick:()=>l("role",u),className:J("rounded-xl border bg-white p-3 text-left transition-all",h===u?"border-brand-500 ring-2 ring-brand-100":"border-ink-100 hover:border-ink-200"),children:[n.jsxs("div",{className:"flex items-center gap-2",children:[u==="driver"?n.jsx(ce,{className:"h-5 w-5 text-brand-600"}):n.jsx(le,{className:"h-5 w-5 text-brand-600"}),n.jsx("span",{className:"text-sm font-semibold text-neutral-900",children:u==="driver"?"Rides & trips":"Food & grocery"})]}),n.jsx("p",{className:"mt-1 text-[11px] text-neutral-400",children:u==="driver"?"Drive customers in your car":"Deliver orders with a bike or scooter"})]},u))}),n.jsxs("form",{onSubmit:m,className:"space-y-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-card",children:[n.jsxs("section",{children:[n.jsx("h2",{className:"mb-3 text-sm font-bold text-neutral-900",children:"Account"}),n.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[n.jsx(_,{label:"Full name",required:!0,className:"sm:col-span-2",children:n.jsx(S,{value:t.name,onChange:u=>l("name",u.target.value),placeholder:"As per Aadhaar / licence",required:!0})}),n.jsx(_,{label:"Email",required:!0,children:n.jsx(S,{type:"email",value:t.email,onChange:u=>l("email",u.target.value),placeholder:"you@example.com",required:!0})}),n.jsx(_,{label:"Phone",required:!0,children:n.jsx(S,{type:"tel",value:t.phone,onChange:u=>l("phone",u.target.value),placeholder:"10-digit mobile number",required:!0})}),n.jsx(_,{label:"Password",required:!0,className:"sm:col-span-2",children:n.jsx(S,{type:"password",value:t.password,onChange:u=>l("password",u.target.value),placeholder:"Minimum 8 characters",minLength:8,required:!0})})]})]}),n.jsxs("section",{className:"border-t border-ink-100 pt-6",children:[n.jsx("h2",{className:"mb-3 text-sm font-bold text-neutral-900",children:"Vehicle details"}),n.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[h==="driver"?n.jsx(_,{label:"Vehicle type",required:!0,children:n.jsxs(Se,{value:t.vehicle_type_id??"",onChange:u=>l("vehicle_type_id",u.target.value?Number(u.target.value):void 0),required:!0,children:[n.jsx("option",{value:"",children:"Select…"}),s.map(u=>n.jsx("option",{value:u.id,children:u.name},u.id))]})}):n.jsx(_,{label:"Vehicle type",required:!0,children:n.jsxs(Se,{value:t.vehicle_type??"",onChange:u=>l("vehicle_type",u.target.value),required:!0,children:[n.jsx("option",{value:"",children:"Select…"}),n.jsx("option",{value:"bike",children:"Bike"}),n.jsx("option",{value:"scooter",children:"Scooter"}),n.jsx("option",{value:"bicycle",children:"Bicycle"}),n.jsx("option",{value:"car",children:"Car"})]})}),n.jsx(_,{label:"Vehicle number",required:!0,children:n.jsx(S,{value:t.vehicle_number??"",onChange:u=>l("vehicle_number",u.target.value),placeholder:"KA-01-AB-1234",required:!0})}),n.jsx(_,{label:"Vehicle model",hint:"e.g. Maruti Swift",children:n.jsx(S,{value:t.vehicle_model??"",onChange:u=>l("vehicle_model",u.target.value)})}),n.jsx(_,{label:"Vehicle colour",children:n.jsx(S,{value:t.vehicle_color??"",onChange:u=>l("vehicle_color",u.target.value)})})]})]}),h==="delivery_partner"&&n.jsxs(n.Fragment,{children:[n.jsxs("section",{className:"border-t border-ink-100 pt-6",children:[n.jsx("h2",{className:"mb-3 text-sm font-bold text-neutral-900",children:"What will you deliver?"}),n.jsx("p",{className:"mb-3 text-xs text-neutral-400",children:"Choose one — you'll receive dispatch offers for that service only."}),n.jsx("div",{className:"grid grid-cols-2 gap-3",children:["food","grocery"].map(u=>n.jsxs("button",{type:"button",onClick:()=>l("service_type",u),className:J("rounded-xl border bg-white p-3 text-left transition-all",(t.service_type??"food")===u?"border-brand-500 ring-2 ring-brand-100":"border-ink-100 hover:border-ink-200"),children:[n.jsxs("div",{className:"flex items-center gap-2",children:[u==="food"?n.jsx(Ea,{className:"h-5 w-5 text-brand-600"}):n.jsx(ka,{className:"h-5 w-5 text-brand-600"}),n.jsx("span",{className:"text-sm font-semibold text-neutral-900",children:u==="food"?"Food orders":"Grocery orders"})]}),n.jsx("p",{className:"mt-1 text-[11px] text-neutral-400",children:u==="food"?"Deliver meals from restaurants":"Deliver groceries & staples"})]},u))})]}),n.jsxs("section",{className:"border-t border-ink-100 pt-6",children:[n.jsx("h2",{className:"mb-3 text-sm font-bold text-neutral-900",children:"Service zone"}),n.jsx("p",{className:"mb-3 text-xs text-neutral-400",children:"Choose the zone you'll be delivering in — your dispatches stay within it."}),n.jsx(_,{label:"Zone",hint:"Required for delivery partners",children:n.jsxs(Se,{value:t.zone_id??"",onChange:u=>l("zone_id",u.target.value?Number(u.target.value):null),children:[n.jsx("option",{value:"",children:"Select a zone…"}),i.map(u=>n.jsxs("option",{value:u.id,children:[u.name,u.code?` (${u.code})`:""]},u.id))]})})]})]}),n.jsxs("section",{className:"border-t border-ink-100 pt-6",children:[n.jsx("h2",{className:"mb-3 text-sm font-bold text-neutral-900",children:"Licence & KYC"}),n.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[n.jsx(_,{label:"Driving licence number",required:!0,children:n.jsx(S,{value:t.license_number??"",onChange:u=>l("license_number",u.target.value),required:!0})}),n.jsx(_,{label:"Licence expiry",required:!0,children:n.jsx(S,{type:"date",value:t.license_expiry??"",onChange:u=>l("license_expiry",u.target.value),required:!0})}),n.jsx(_,{label:"Aadhaar number",required:!0,children:n.jsx(S,{value:t.aadhar_number??"",onChange:u=>l("aadhar_number",u.target.value),placeholder:"12-digit Aadhaar",required:!0})}),h==="driver"&&n.jsx(_,{label:"PAN number",children:n.jsx(S,{value:t.pan_number??"",onChange:u=>l("pan_number",u.target.value)})})]})]}),n.jsxs("section",{className:"border-t border-ink-100 pt-6",children:[n.jsx("h2",{className:"mb-3 text-sm font-bold text-neutral-900",children:"Payout bank details"}),n.jsx("p",{className:"mb-3 text-xs text-neutral-400",children:"Optional at signup — you can add these later from Profile & KYC."}),n.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[n.jsx(_,{label:"Account holder name",children:n.jsx(S,{value:t.bank_account_name??"",onChange:u=>l("bank_account_name",u.target.value)})}),n.jsx(_,{label:"Bank name",children:n.jsx(S,{value:t.bank_name??"",onChange:u=>l("bank_name",u.target.value)})}),n.jsx(_,{label:"Account number",children:n.jsx(S,{value:t.bank_account_number??"",onChange:u=>l("bank_account_number",u.target.value)})}),n.jsx(_,{label:"IFSC",children:n.jsx(S,{value:t.bank_ifsc??"",onChange:u=>l("bank_ifsc",u.target.value),placeholder:"HDFC0000123"})})]})]}),n.jsxs("div",{className:"flex flex-col gap-3 pt-2",children:[n.jsxs(E,{type:"submit",className:"w-full",disabled:c,children:[c?"Submitting…":"Submit application",!c&&n.jsx(Er,{className:"h-4 w-4"})]}),n.jsxs(ot,{to:"/login",className:"inline-flex items-center justify-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-700",children:[n.jsx(da,{className:"h-4 w-4"})," Already registered? Sign in"]})]})]})]})})}function Ye({title:e,description:t,actions:r,children:s}){return n.jsxs("div",{children:[n.jsxs("div",{className:"mb-6 flex flex-wrap items-end justify-between gap-4",children:[n.jsxs("div",{children:[n.jsx("h1",{className:"text-2xl font-bold tracking-tight text-neutral-900",children:e}),t&&n.jsx("p",{className:"mt-1 text-sm text-neutral-500",children:t})]}),r&&n.jsx("div",{className:"flex items-center gap-2",children:r})]}),s]})}const lc={brand:"text-brand-600",success:"text-emerald-600",accent:"text-amber-500",violet:"text-violet-600",slate:"text-neutral-500",warning:"text-amber-600"};function H({label:e,value:t,sub:r,icon:s,tone:a="brand",dense:i=!1}){return n.jsxs("div",{className:J("rounded-2xl border border-ink-100 bg-white shadow-card",i?"p-3":"p-4"),children:[s&&n.jsx("div",{className:J("flex items-center justify-center rounded-xl bg-ink-50",lc[a],i?"mb-2 h-8 w-8":"mb-3 h-9 w-9"),children:n.jsx(s,{className:i?"h-4 w-4":"h-4.5 w-4.5"})}),n.jsx("p",{className:J("font-medium text-neutral-500",i?"text-xs leading-snug":"text-xs"),children:e}),n.jsx("p",{className:J("font-bold tracking-tight text-neutral-900",i?"mt-0.5 truncate text-lg":"mt-1 text-2xl"),children:t}),r&&n.jsx("p",{className:J("text-neutral-400",i?"mt-0.5 text-[11px] leading-snug":"mt-1 text-xs"),children:r})]})}function bn({className:e="",rows:t=6}){return n.jsx("div",{className:`w-full space-y-4 ${e}`,children:Array.from({length:t}).map((r,s)=>n.jsx("div",{className:"h-4 animate-pulse rounded-full bg-ink-100",style:{width:`${100-s%3*20}%`}},s))})}function we({message:e="Something went wrong",onRetry:t,className:r=""}){return n.jsxs("div",{className:`flex flex-col items-center justify-center gap-3 py-16 text-center ${r}`,children:[n.jsx("p",{className:"text-sm font-medium text-neutral-700",children:e}),t&&n.jsxs(E,{variant:"outline",size:"sm",onClick:t,children:[n.jsx(Ar,{className:"h-3.5 w-3.5"})," Retry"]})]})}const V=p.forwardRef(({className:e="",children:t,...r},s)=>n.jsx("div",{ref:s,className:`rounded-2xl border border-ink-100 bg-white p-6 shadow-card ${e}`,...r,children:t}));V.displayName="Card";const Be=p.forwardRef(({className:e="",children:t,...r},s)=>n.jsx("div",{ref:s,className:`mb-4 flex items-start justify-between gap-3 px-5 pt-4 ${e}`,...r,children:t}));Be.displayName="CardHeader";const qe=p.forwardRef(({className:e="",children:t,...r},s)=>n.jsx("h3",{ref:s,className:`text-base font-bold text-neutral-900 ${e}`,...r,children:t}));qe.displayName="CardTitle";const cc=p.forwardRef(({className:e="",children:t,...r},s)=>n.jsx("p",{ref:s,className:`mt-0.5 text-sm text-neutral-500 ${e}`,...r,children:t}));cc.displayName="CardDescription";const dc=p.forwardRef(({className:e="",children:t,...r},s)=>n.jsx("div",{ref:s,className:`mt-5 border-t border-ink-100 pt-4 ${e}`,...r,children:t}));dc.displayName="CardFooter";function Xt(e){if(!e)return"—";const t=[e.address_line_1,e.address_line_2,e.city,e.postal_code].filter(Boolean);return t.length?t.join(", "):`#${e.id}`}const rr="https://www.google.com/maps";function Qe(e){if(!e)return null;const t=Number(e.latitude),r=Number(e.longitude);return Number.isFinite(t)&&Number.isFinite(r)&&t!==0&&r!==0?{lat:t,lng:r}:null}function at(e){return Qe(e)}function ws(e){return Qe({latitude:e.pickup_latitude,longitude:e.pickup_longitude})}function js(e){return Qe({latitude:e.destination_latitude,longitude:e.destination_longitude})}function _s(e){var r,s;if(!e)return"Store";const t=(r=e.address)==null?void 0:r.trim();return t||((s=e.business_name)==null?void 0:s.trim())||"Store"}function uc(e){if(!e)return"—";const t=[e.address_line_1,e.address_line_2,e.landmark,e.city,e.state,e.postal_code].filter(r=>typeof r=="string"&&r.trim()!=="");return t.length?t.join(", "):`#${e.id}`}function mc(e,t){const r=Qe(e),s=Qe(t);if(r&&s){const c=((r.lat+s.lat)/2).toFixed(5),d=((r.lng+s.lng)/2).toFixed(5);return`${rr}/dir/${r.lat},${r.lng}/${s.lat},${s.lng}/@${c},${d},14z/data=!3m1!4b1!4m2!4m1!3e0`}const a=_s(e),i=uc(t);if(i==="—")return null;const o=`{"origin":{"text":"${a}"},"destination":{"text":"${i}"}}`;return`${rr}/search/${encodeURIComponent(o)}`}function hc(e){return _s(e)}function Ns(e,t){return mc(e,(t==null?void 0:t.address)??null)}function Je(){const{data:e}=te({queryKey:["maps-config"],queryFn:()=>ea.maps(),staleTime:3e5});return(e==null?void 0:e.enabled)===!0&&(e!=null&&e.public_key)?e.public_key:null}const pc=e=>`The setOptions() function should only be called once. The options passed to the additional call (${JSON.stringify(e)}) will be ignored.`,fc=e=>`The google.maps.importLibrary() function is already defined, and @googlemaps/js-api-loader will use the existing function instead of overwriting it. The options passed to setOptions (${JSON.stringify(e)}) will be ignored.`,xc=(e,t)=>`Failed to create Trusted Types policy "${e}": ${t instanceof Error?t.message:String(t)}.

If your Content Security Policy uses "require-trusted-types-for 'script'", allow this policy with "trusted-types ${e} google-maps-api-loader google-maps-api#html lit-html". The "google-maps-api-loader", "lit-html", and "google-maps-api#html" policies are required for full Maps JavaScript API execution. Falling back to a string script URL.`,ks=()=>{},gc=()=>{},sr="@googlemaps/js-api-loader",ar={createScriptURL:e=>e};let je;function bc(){if(je)return je;const e=globalThis.trustedTypes;if(!e)return je=ar,je;try{je=e.createPolicy(sr,{createScriptURL:t=>t})}catch(t){ks(xc(sr,t)),je=ar}return je}function yc(e,t){e.src=bc().createScriptURL(t)}const vc=e=>{var t,r,s,a="The Google Maps JavaScript API",i="google",o="importLibrary",c="__ib__",d=document,l=window,h=l[i]||(l[i]={}),m=h.maps||(h.maps={}),u=new Set,f=new URLSearchParams,j=()=>t||(t=new Promise(async(I,b)=>{var $;await(r=d.createElement("script")),f.set("libraries",[...u]+"");for(s in e)f.set(s.replace(/[A-Z]/g,D=>"_"+D[0].toLowerCase()),e[s]);f.set("callback",i+".maps."+c),yc(r,"https://maps.googleapis.com/maps/api/js?"+f),m[c]=I,r.onerror=()=>t=b(Error(a+" could not load.")),r.nonce=(($=d.querySelector("script[nonce]"))==null?void 0:$.nonce)||"",d.head.append(r)}));m[o]?console.warn(a+" only loads once. Ignoring:",e):m[o]=(I,...b)=>u.add(I)&&j().then(()=>m[o](I,...b))};let ir=!1;function wc(e){if(ir){ks(pc(e));return}e.apiKey&&(e.key||(e.key=e.apiKey)),jc(e),ir=!0}async function Ot(e){var t,r;if(!((r=(t=window==null?void 0:window.google)==null?void 0:t.maps)!=null&&r.importLibrary))throw new Error("google.maps.importLibrary is not installed.");return await google.maps.importLibrary(e)}function jc(e){var r,s;const t=!!((s=(r=window.google)==null?void 0:r.maps)!=null&&s.importLibrary);t&&gc(fc(e)),t||vc(e)}let Re=null,Mt=null;function _c(e){return Re&&Mt===e||(Mt=e,wc({key:e,v:"weekly",libraries:["maps","marker","geometry"]}),Re=(async()=>{await Ot("maps"),await Ot("marker"),await Ot("geometry")})(),Re.catch(()=>{Mt===e&&(Re=null)})),Re}const or={lat:28.6139,lng:77.209},oe={driver:"#2563eb",origin:"#16a34a",destination:"#ea580c",route:"#111827"},et=["#16a34a","#ea580c","#7c3aed","#0891b2","#db2777"];function ge(e){return!!e&&Number.isFinite(e.lat)&&Number.isFinite(e.lng)&&(e.lat!==0||e.lng!==0)}function Nc(e,t){return`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path fill="${t}" stroke="#ffffff" stroke-width="1.5" d="M18 1C9.7 1 3 7.7 3 16c0 11.2 15 27 15 27s15-15.8 15-27C33 7.7 26.3 1 18 1z"/><circle cx="18" cy="16" r="7" fill="#ffffff"/><text x="18" y="20" font-family="system-ui,sans-serif" font-size="11" font-weight="700" text-anchor="middle" fill="${t}">${e}</text></svg>`)}`}function kc(e){return`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path fill="${e}" stroke="#ffffff" stroke-width="1.5" d="M18 1C9.7 1 3 7.7 3 16c0 11.2 15 27 15 27s15-15.8 15-27C33 7.7 26.3 1 18 1z"/><circle cx="18" cy="16" r="5" fill="#ffffff" opacity="0.95"/></svg>`)}`}function Sc(){return{path:google.maps.SymbolPath.CIRCLE,scale:8,fillColor:oe.driver,fillOpacity:1,strokeColor:"#ffffff",strokeWeight:2.5}}function Ec(e,t,r){const s=ge(t)?t:ge(r)?r:null;if(!s)return null;const a=e?`${e.lat},${e.lng}`:"my location";return`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a)}&destination=${encodeURIComponent(`${s.lat},${s.lng}`)}`}function Cc(e,t){const r=t[0];if(!r)return null;const s=e?`${e.lat},${e.lng}`:"my location";return`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(s)}&destination=${encodeURIComponent(`${r.lat},${r.lng}`)}`}let tt=null,lr=0,Ve=null;function Ic(){const e=Date.now();return tt&&e-lr<45e3?Promise.resolve(tt):Ve||(Ve=ln().then(t=>(tt={lat:t.latitude,lng:t.longitude},lr=Date.now(),tt)).catch(()=>null).finally(()=>{Ve=null}),Ve)}function Xe({apiKey:e,origin:t,destination:r,stops:s,showDriver:a=!0,labels:i,className:o}){const c=p.useRef(null),d=p.useRef(null),l=p.useRef([]),h=p.useRef(null),m=p.useRef(""),[u,f]=p.useState(!1),[j,I]=p.useState(!1),[b,$]=p.useState(null),D=ge(t)?t:null,C=ge(r)?r:null,x=(s??[]).filter(v=>ge(v==null?void 0:v.point));if(p.useEffect(()=>{const v=c.current;if(!e||!v)return;let M=!1;return _c(e).then(()=>{if(M)return;const U=new google.maps.Map(v,{zoom:14,center:or,disableDefaultUI:!0,zoomControl:!0,clickableIcons:!1});d.current=U,f(!0)}).catch(()=>{M||I(!0)}),()=>{M=!0}},[e]),p.useEffect(()=>{if(!e||!a)return;let v=!1;return Ic().then(M=>{v||$(M)}),()=>{v=!0}},[e,a]),p.useEffect(()=>{var xe;const v=d.current;if(!v||!u)return;const M=JSON.stringify([D,C,x.map(N=>[N.point,N.label,N.legDistanceKm,N.legDurationMin]),a&&ge(b)?b:null]);if(M===m.current)return;m.current=M,l.current.forEach(N=>N.setMap(null)),l.current=[],(xe=h.current)==null||xe.setMap(null),h.current=null;const U=new google.maps.LatLngBounds,F=(N,Y,k)=>{U.extend(new google.maps.LatLng(N.lat,N.lng));const ee=new google.maps.Marker({map:v,position:{lat:N.lat,lng:N.lng},icon:kc(Y),title:k});l.current.push(ee)},Q=(N,Y,k)=>{U.extend(new google.maps.LatLng(N.lat,N.lng));const ee=new google.maps.Marker({map:v,position:{lat:N.lat,lng:N.lng},icon:Nc(Y,et[Y%et.length]),zIndex:4,title:k});l.current.push(ee)},Ae=(N,Y)=>{U.extend(new google.maps.LatLng(N.lat,N.lng));const k=new google.maps.Marker({map:v,position:{lat:N.lat,lng:N.lng},icon:Sc(),zIndex:5,title:Y});l.current.push(k)};if(a&&ge(b)&&Ae(b,"Your location"),x.length>0)x.forEach((N,Y)=>{Q(N.point,Y+1,N.label??`Stop ${Y+1}`)}),h.current=new google.maps.Polyline({map:v,path:x.map(N=>({lat:N.point.lat,lng:N.point.lng})),strokeColor:oe.route,strokeOpacity:.6,strokeWeight:4,zIndex:3,clickable:!1});else if(D&&F(D,oe.origin,(i==null?void 0:i.origin)??"Pickup"),C&&F(C,oe.destination,(i==null?void 0:i.destination)??"Destination"),D&&C)h.current=new google.maps.Polyline({map:v,path:[{lat:D.lat,lng:D.lng},{lat:C.lat,lng:C.lng}],strokeColor:oe.route,strokeOpacity:.6,strokeWeight:4,zIndex:3,clickable:!1});else if(a&&ge(b)&&(D??C)){const N=D??C;N&&(h.current=new google.maps.Polyline({map:v,path:[{lat:b.lat,lng:b.lng},{lat:N.lat,lng:N.lng}],strokeColor:oe.route,strokeOpacity:.5,strokeWeight:3,zIndex:3,clickable:!1}))}U.isEmpty()?(v.setCenter(or),v.setZoom(14)):v.fitBounds(U)},[u,b,t,r,s,a]),!e||!D&&!C&&x.length===0)return null;const O=x.length?Cc(a?b:null,x.map(v=>v.point)):Ec(a?b:null,D,C);return n.jsxs("div",{className:J("relative overflow-hidden bg-neutral-100",o),children:[!u&&!j&&n.jsx("div",{className:"absolute inset-0 z-10 flex items-center justify-center bg-neutral-100",children:n.jsx(ct,{className:"h-5 w-5 animate-spin text-brand-600"})}),j&&n.jsx("div",{className:"absolute inset-0 z-10 flex items-center justify-center bg-neutral-100 px-4 text-center text-sm text-neutral-500",children:"Map unavailable"}),n.jsx("div",{ref:c,className:"absolute inset-0"}),u&&x.length>0&&n.jsxs("div",{className:"absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-neutral-600 shadow-card",children:[a&&n.jsxs("span",{className:"flex items-center gap-1",children:[n.jsx("span",{className:"h-2 w-2 rounded-full",style:{background:oe.driver}}),"You"]}),x.map((v,M)=>n.jsxs("span",{className:"flex items-center gap-1",children:[n.jsx("span",{className:"flex h-2.5 w-2.5 items-center justify-center rounded-full text-[8px] font-bold text-white",style:{background:et[M%et.length]},children:M+1}),n.jsx("span",{className:"max-w-[9rem] truncate",children:v.label??`Stop ${M+1}`})]},`${v.label??"stop"}-${M}`))]}),u&&x.length===0&&n.jsxs("div",{className:"absolute left-2 top-2 z-10 flex items-center gap-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-neutral-600 shadow-card",children:[a&&n.jsxs("span",{className:"flex items-center gap-1",children:[n.jsx("span",{className:"h-2 w-2 rounded-full",style:{background:oe.driver}}),"You"]}),D&&n.jsxs("span",{className:"flex items-center gap-1",children:[n.jsx("span",{className:"h-2 w-2 rounded-full",style:{background:oe.origin}}),(i==null?void 0:i.origin)??"Pickup"]}),C&&n.jsxs("span",{className:"flex items-center gap-1",children:[n.jsx("span",{className:"h-2 w-2 rounded-full",style:{background:oe.destination}}),(i==null?void 0:i.destination)??"Drop"]})]}),O&&n.jsxs("a",{href:O,target:"_blank",rel:"noreferrer noopener",className:"absolute bottom-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white shadow-card hover:bg-brand-700",children:[n.jsx(ja,{className:"h-3.5 w-3.5"}),"Navigate"]})]})}const Tc="https://checkout.razorpay.com/v1/checkout.js";let Pe=null;function Ac(e){return document.querySelector(`script[src="${e}"]`)?Promise.resolve():new Promise((t,r)=>{const s=document.createElement("script");s.src=e,s.async=!0,s.onload=()=>t(),s.onerror=()=>r(new Error(`Failed to load ${e}`)),document.head.appendChild(s)})}function Dc(){return Pe||(window.Razorpay?(Pe=Promise.resolve(),Pe):(Pe=Ac(Tc),Pe))}async function Rc(e){const t=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e));return`pay_${Array.from(new Uint8Array(t)).map(s=>s.toString(16).padStart(2,"0")).join("").slice(0,16)}`}async function Pc(e,t=q.verifyWalletTopup){const r=e.payment_number,s=e.provider_order_id??"";if(e.mock)return t({payment_number:r,provider_order_id:s,provider_payment_id:await Rc(s),signature:"mock"});await Dc();const a=window.Razorpay;if(!a)throw new Error("Razorpay checkout is unavailable.");return new Promise((i,o)=>{new a({key:e.key_id??"",amount:e.amount_paise,currency:e.currency,name:"SuperBasket Partner",description:`Wallet top-up ${r}`,order_id:s,theme:{color:"#1b66f5"},modal:{ondismiss:()=>i(null)},handler:async d=>{try{const l=await t({payment_number:r,provider_payment_id:d.razorpay_payment_id,provider_order_id:d.razorpay_order_id,signature:d.razorpay_signature});i(l)}catch(l){o(l)}}}).open()})}function yn({open:e,onClose:t,label:r,suggested:s,onCredited:a}){const o=R(h=>h.role)==="delivery_partner"?q:z,[c,d]=p.useState(s&&s>0?String(Math.ceil(s)):""),l=G({mutationFn:async()=>{const h=Number(c);if(!Number.isFinite(h)||h<=0)throw new Error("Enter a valid amount");const m=await o.walletTopup(h,"upi",`topup:${Date.now()}`),u=await Pc(m,o.verifyWalletTopup);if(!u||u.status!=="SUCCESS")throw new Error("Top-up was not completed");return u},onSuccess:h=>{y("Money added to your wallet"),a==null||a(h.wallet.available_balance??h.wallet.balance),t()},onError:h=>y(h instanceof Error?h.message:"Top-up failed","error")});return e?n.jsx("div",{className:"fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/50 p-4 sm:items-center",role:"dialog","aria-modal":"true",children:n.jsxs("div",{className:"w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl",children:[n.jsxs("div",{className:"flex items-start justify-between gap-3",children:[n.jsxs("div",{className:"flex items-center gap-3",children:[n.jsx("span",{className:"flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700",children:n.jsx(Ue,{className:"h-5 w-5"})}),n.jsxs("div",{children:[n.jsx("p",{className:"text-sm font-bold text-neutral-900",children:"Add money"}),n.jsx("p",{className:"text-xs text-neutral-500",children:r??"Top up your wallet to settle cash collected."})]})]}),n.jsx("button",{type:"button",className:"text-neutral-400 hover:text-neutral-600",onClick:t,"aria-label":"Close",children:n.jsx(sn,{className:"h-5 w-5"})})]}),n.jsxs("div",{className:"mt-4",children:[n.jsx(S,{type:"number",inputMode:"decimal",min:1,step:1,value:c,onChange:h=>d(h.target.value),placeholder:"Enter amount",disabled:l.isPending}),s&&s>0&&n.jsxs("p",{className:"mt-1.5 text-xs text-neutral-500",children:["Suggested: ",T(Math.ceil(s))," — enough to cover the cash settlement shortfall."]})]}),n.jsxs(E,{className:"mt-4 w-full",onClick:()=>l.mutate(),disabled:l.isPending,children:[l.isPending?n.jsx(ct,{className:"h-4 w-4 animate-spin"}):null,l.isPending?"Processing…":"Add money"]})]})}):null}function vn(){return R(t=>t.role)==="delivery_partner"?n.jsx($c,{}):n.jsx(Mc,{})}const Oc=["DRIVER_ASSIGNED","DRIVER_ARRIVING","DRIVER_ARRIVED","IN_PROGRESS","COMPLETED"],cr=["PARTNER_ASSIGNED","PICKED_UP","OUT_FOR_DELIVERY","ARRIVED","DELIVERED"];function Zt({steps:e,current:t}){const r=e.indexOf(t);return n.jsx("div",{className:"flex items-center gap-1",children:e.map((s,a)=>n.jsxs("div",{className:"flex flex-1 flex-col items-center gap-1",children:[n.jsx("div",{className:`h-1.5 w-full rounded-full ${a<=r?"bg-brand-600":"bg-ink-100"}`}),n.jsx("span",{className:`text-[10px] font-medium ${a===r?"text-brand-700":"text-neutral-400"}`,children:s.replace(/_/g," ")})]},s))})}function Mc(){const e=de(),{activeRide:t,setActiveRide:r}=se(),[s,a]=p.useState(""),[i,o]=p.useState(null),[c,d]=p.useState(!1),l=Je(),{data:h}=te({queryKey:["driver","active-trip"],queryFn:()=>z.activeTrip(),refetchInterval:15e3,refetchIntervalInBackground:!0}),m=t??h??null,u=i??(h==null?void 0:h.payment)??null;p.useEffect(()=>{o(null)},[m==null?void 0:m.id]),p.useEffect(()=>{if(h===null){se.getState().activeRide&&r(null);return}if(h===void 0)return;const k=se.getState().activeRide;if(!k){r(h);return}if(k.id!==h.id){r(h);return}if(ra(k,h))return;const ee={};for(const ie of kr)k[ie]!==h[ie]&&(ee[ie]=h[ie]);Object.keys(ee).length!==0&&r({...k,...ee})},[h,r]);const f=G({mutationFn:k=>z.updateTripStatus(m.id,k),onSuccess:k=>{k.status==="COMPLETED"?(y("Trip completed"),r(null),e.invalidateQueries({queryKey:["driver-requests"]}),e.invalidateQueries({queryKey:["driver-earnings"]}),e.invalidateQueries({queryKey:["driver","active-trip"]})):r(k)},onError:k=>y(k instanceof Error?k.message:"Update failed","error")}),j=G({mutationFn:()=>z.verifyOtp(m.id,s),onSuccess:k=>{y("OTP verified — trip started"),a(""),r(k)},onError:k=>y(k instanceof Error?k.message:"OTP verification failed","error")}),I=G({mutationFn:()=>z.cashCollect(m.id,"cash"),onSuccess:({ride:k,payment:ee})=>{r(k),o(ee),y("Cash collected — settle the amount in your wallet"),e.invalidateQueries({queryKey:["driver-wallet"]})},onError:k=>y(k instanceof Error?k.message:"Cash collection failed","error")}),b=G({mutationFn:()=>z.settleCash(m.id),onSuccess:({ride:k,payment:ee,settled:ie})=>{r(k),o(ee),y(ie?"Cash settlement complete":"Wallet balance is short of the settlement amount"),e.invalidateQueries({queryKey:["driver-wallet"]}),e.invalidateQueries({queryKey:["driver","active-trip"]})},onError:k=>y(k instanceof Error?k.message:"Cash settlement failed","error")});if(!m)return null;const $=m.status.toUpperCase(),D=["paid","PAID"].includes((m.payment_status??"").toLowerCase()),C=m.payment_method==="wallet",x=!!m.cash_collected,O=!!m.cash_settled,v=x&&!O,M=D&&!x,U=D&&(!x||O),F=U||C&&!x,Q=m.final_fare??m.estimated_fare??0,Ae=!D&&!x&&!C&&["DRIVER_ARRIVED","IN_PROGRESS"].includes($),xe=!U&&!v,N=(u==null?void 0:u.settlement)==="pending"?Math.max(0,Math.ceil(u.shortfall||0)):0,Y=$==="DRIVER_ASSIGNED"?{label:"I'm arriving",next:"arriving"}:$==="DRIVER_ARRIVING"?{label:"I've arrived",next:"arrived"}:null;return n.jsxs(V,{className:"ring-2 ring-brand-600/30",children:[n.jsxs("div",{className:"mb-4 flex items-center justify-between gap-2",children:[n.jsxs("div",{children:[n.jsx("p",{className:"text-xs font-semibold uppercase tracking-wide text-brand-700",children:"Active ride"}),n.jsx("p",{className:"font-bold text-neutral-900",children:m.ride_number})]}),n.jsx(ae,{status:m.status})]}),n.jsx(Zt,{steps:Oc,current:$}),n.jsx(Xe,{apiKey:l,origin:ws(m),destination:js(m),showDriver:!0,className:"mt-4 h-48 w-full overflow-hidden rounded-xl ring-1 ring-ink-100",labels:{origin:"Pickup",destination:"Drop"}}),n.jsxs("div",{className:"mt-4 space-y-2 text-sm",children:[n.jsxs("div",{className:"flex items-start gap-2",children:[n.jsx("span",{className:"mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500"}),n.jsx("span",{className:"text-neutral-700",children:m.pickup_address??"Pickup point"})]}),n.jsxs("div",{className:"flex items-start gap-2",children:[n.jsx("span",{className:"mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600"}),n.jsx("span",{className:"text-neutral-700",children:m.destination_address??"Destination"})]})]}),n.jsxs("div",{className:"mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500",children:[n.jsxs("span",{children:[Number(m.distance_km??0).toFixed(1)," km"]}),n.jsxs("span",{children:[m.duration_min??"—"," min"]}),n.jsx("span",{className:"capitalize",children:m.payment_method??"—"}),n.jsx("span",{className:"ml-auto font-semibold text-neutral-900",children:X(m.estimated_fare??0)})]}),m.user&&n.jsxs("div",{className:"mt-3 rounded-xl bg-ink-50 px-3 py-2 text-sm",children:[n.jsx("p",{className:"font-medium text-neutral-900",children:m.user.name}),n.jsx("p",{className:"text-xs text-neutral-500",children:m.user.phone??""})]}),n.jsxs("div",{className:"mt-4",children:[xe&&n.jsxs("div",{className:"mb-3 rounded-xl bg-ink-50 p-3",children:[n.jsx("p",{className:"text-xs font-semibold uppercase tracking-wide text-neutral-500",children:"Payment"}),n.jsx("p",{className:"mt-0.5 text-lg font-bold text-neutral-900",children:X(Q)}),n.jsx("p",{className:"mt-0.5 text-xs text-neutral-500",children:C?"The fare will be deducted from the customer’s wallet when the trip completes.":Ae?"Cash payment — collect from the customer.":"The customer can pay online from the customer app, or in cash when you arrive."}),Ae&&n.jsx("div",{className:"mt-2 flex gap-2",children:n.jsx(E,{className:"flex-1",disabled:I.isPending||f.isPending,onClick:()=>I.mutate(),children:I.isPending?"Recording…":"Collect cash"})})]}),M&&n.jsxs("div",{className:"mb-3 rounded-xl bg-emerald-50 p-3",children:[n.jsx("p",{className:"text-sm font-semibold text-emerald-700",children:"Payment received online"}),n.jsx("p",{className:"mt-0.5 text-xs text-emerald-600",children:"No cash to collect — the customer paid on the app."})]}),v&&n.jsx("div",{className:"mb-3 rounded-xl bg-amber-50 p-3",children:N>0?n.jsxs(n.Fragment,{children:[n.jsx("p",{className:"text-xs font-semibold uppercase tracking-wide text-amber-700",children:"Wallet balance insufficient"}),n.jsxs("p",{className:"mt-1 text-sm text-neutral-700",children:["Required ",T((u==null?void 0:u.required)??m.cash_collected_amount??0)," · Available"," ",T((u==null?void 0:u.available)??(u==null?void 0:u.wallet_balance)??0)]}),n.jsx("div",{className:"mt-2 flex gap-2",children:n.jsxs(E,{variant:"secondary",className:"flex-1",disabled:I.isPending||b.isPending,onClick:()=>d(!0),children:["Add ",T(N)]})}),n.jsx("p",{className:"mt-1.5 text-xs text-neutral-500",children:"Add money to your wallet, then settle the collected cash."})]}):n.jsxs(n.Fragment,{children:[n.jsx("p",{className:"text-xs font-semibold uppercase tracking-wide text-amber-700",children:"Cash collected"}),n.jsx("p",{className:"mt-0.5 text-lg font-bold text-neutral-900",children:T((u==null?void 0:u.required)??m.cash_collected_amount??0)}),n.jsxs("p",{className:"mt-0.5 text-xs text-neutral-500",children:["Cash settlement required — settle from your wallet balance",u?` (${T(u.wallet_balance)})`:"","."]}),n.jsxs("div",{className:"mt-2 flex gap-2",children:[n.jsx(E,{variant:"outline",className:"flex-1",disabled:b.isPending||((u==null?void 0:u.settlement)??"pending")!=="pending",onClick:()=>b.mutate(),children:b.isPending?"Settling…":"Settle cash"}),n.jsx(E,{variant:"secondary",disabled:I.isPending||b.isPending,onClick:()=>d(!0),children:"Add money"})]})]})}),O&&n.jsxs("div",{className:"mb-3 rounded-xl bg-emerald-50 p-3",children:[n.jsxs("p",{className:"text-sm font-semibold text-emerald-700",children:["Cash payment settled — ",T(m.cash_collected_amount??0)]}),n.jsx("p",{className:"mt-0.5 text-xs text-emerald-600",children:"Collected cash settled from your wallet — the trip can be completed."})]}),Y?n.jsx(E,{className:"w-full",disabled:f.isPending,onClick:()=>f.mutate(Y.next),children:f.isPending?"Updating…":Y.label}):$==="DRIVER_ARRIVED"?n.jsxs("div",{className:"space-y-2",children:[n.jsx("p",{className:"text-xs text-neutral-500",children:"Ask the customer for the 6-digit OTP to start the trip."}),n.jsxs("div",{className:"flex gap-2",children:[n.jsx(S,{inputMode:"numeric",maxLength:6,placeholder:"••••••",value:s,onChange:k=>a(k.target.value.replace(/\D/g,"")),className:"w-36 font-mono tracking-[0.3em]"}),n.jsx(E,{className:"flex-1",disabled:s.length!==6||j.isPending,onClick:()=>j.mutate(),children:j.isPending?"Starting…":"Start trip"})]})]}):n.jsxs("div",{className:"space-y-2",children:[n.jsx(E,{className:"w-full",disabled:f.isPending||!F,onClick:()=>f.mutate("completed"),children:f.isPending?"Completing…":"Complete trip"}),!F&&n.jsx("p",{className:"text-center text-xs text-amber-600",children:v?"Settlement pending — settle the collected cash to complete the trip.":"Collect cash from the customer or wait for their online payment."})]}),n.jsx(yn,{open:c,onClose:()=>d(!1),label:"Add money to settle the cash you collected.",suggested:N,onCredited:()=>{b.mutate()}})]})]})}function $c(){const e=se(a=>a.activeOrder),t=se(a=>a.setActiveOrder),{data:r}=te({queryKey:["partner","active-job"],queryFn:()=>q.activeJob(),refetchInterval:15e3,refetchIntervalInBackground:!0});p.useEffect(()=>{if(r===null){se.getState().activeOrder&&t(null);return}if(r===void 0)return;const a=se.getState().activeOrder;(!a||!Nr(a,r))&&t(r)},[r,t]);const s=e??r;return s?Ne(s)?n.jsx(Fc,{batch:s}):n.jsx(Ss,{order:s}):null}function Fc({batch:e}){var o,c;const t=Je(),r=e.route,s=e.stops??[],a=(r==null?void 0:r.pickup_label)??((c=(o=s[0])==null?void 0:o.order.vendor)==null?void 0:c.business_name)??"Store",i=e.completed_stops??0;return n.jsxs(V,{className:"ring-2 ring-brand-600/30",children:[n.jsxs("div",{className:"mb-4 flex items-start justify-between gap-2",children:[n.jsxs("div",{children:[n.jsx("p",{className:"text-xs font-semibold uppercase tracking-wide text-brand-700",children:"Active trip"}),n.jsx("p",{className:"font-bold text-neutral-900",children:e.batch_number??"Batch"}),n.jsxs("p",{className:"text-xs text-neutral-500",children:[i," done · ",e.remaining_stops??e.stop_count," of ",e.max_stops," stops left"]})]}),n.jsx(ae,{status:e.status})]}),e.current_stop&&n.jsxs("div",{className:"mb-3 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800",children:[n.jsx("span",{className:"font-semibold",children:"Next up:"}),n.jsx("span",{className:"font-bold",children:e.current_stop.order_number}),n.jsx(ae,{status:e.current_stop.status,className:"ml-auto"})]}),r&&n.jsxs("div",{className:"mb-3 grid grid-cols-3 gap-2 text-center",children:[n.jsxs("div",{className:"rounded-xl bg-ink-50 px-2 py-1.5",children:[n.jsx("p",{className:"text-[10px] font-semibold uppercase text-neutral-400",children:"Distance"}),n.jsxs("p",{className:"text-sm font-bold text-neutral-900",children:[r.total_distance_km.toFixed(1)," km"]})]}),n.jsxs("div",{className:"rounded-xl bg-ink-50 px-2 py-1.5",children:[n.jsx("p",{className:"text-[10px] font-semibold uppercase text-neutral-400",children:"Drive time"}),n.jsxs("p",{className:"text-sm font-bold text-neutral-900",children:[r.total_duration_min," min"]})]}),n.jsxs("div",{className:"rounded-xl bg-ink-50 px-2 py-1.5",children:[n.jsx("p",{className:"text-[10px] font-semibold uppercase text-neutral-400",children:"Pickup"}),n.jsx("p",{className:"truncate text-sm font-bold text-neutral-900",title:a,children:a})]})]}),e.window_start&&e.window_end&&n.jsxs("p",{className:"mb-3 text-xs text-neutral-500",children:["Deliver between ",new Date(e.window_start).toLocaleTimeString()," and"," ",new Date(e.window_end).toLocaleTimeString()]}),n.jsx(Xe,{apiKey:t,stops:((r==null?void 0:r.stops)??[]).map(d=>({point:d.point,label:d.order_number,legDistanceKm:d.leg_distance_km,legDurationMin:d.leg_duration_min})),showDriver:!0,className:"h-56 w-full overflow-hidden rounded-xl ring-1 ring-ink-100"}),n.jsx("ol",{className:"mt-4 space-y-3",children:s.map((d,l)=>n.jsxs("li",{children:[n.jsxs("div",{className:"mb-1.5 flex items-center gap-2 px-1",children:[n.jsx("span",{className:"flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white",children:l+1}),n.jsx("span",{className:"text-xs font-semibold text-neutral-700",children:d.order_number}),n.jsx(ae,{status:d.status,className:"ml-auto"})]}),n.jsx(Ss,{order:d.order,embedded:!0})]},d.order_id))})]})}function Ss({order:e,embedded:t=!1}){var _n,Nn,kn,Sn,En;const r=de(),s=se(g=>g.setActiveOrder),[a,i]=p.useState(null),[o,c]=p.useState(""),[d,l]=p.useState(""),[h,m]=p.useState(!1),[u,f]=p.useState(null),[j,I]=p.useState(!1),b=p.useRef(!1),$=Je(),D=g=>{s(W=>ta(W,g))},C=g=>{const W=["cash_on_delivery","cod"].includes((g.payment_method??"").toLowerCase()),Rs=g.payment_status==="paid",Cn=!!g.delivery_payment_collected_at,Ps=Cn&&!g.delivery_payment_settled_at;return(Rs||W&&Cn)&&!Ps},x=G({mutationFn:g=>q.updateOrderStatus(e.id,g),onSuccess:g=>{D(g),g.status==="DELIVERED"&&(y("Order delivered"),r.invalidateQueries({queryKey:["partner-orders"]}),r.invalidateQueries({queryKey:["partner-earnings"]})),r.invalidateQueries({queryKey:["partner","active-job"]})},onError:g=>y(g instanceof Error?g.message:"Update failed","error")}),O=G({mutationFn:()=>q.uploadProof(e.id,a,o),onError:g=>y(g instanceof Error?g.message:"Proof upload failed","error")}),v=G({mutationFn:()=>q.confirmPayment(e.id,"cash"),onSuccess:({order:g,payment:W})=>{D(g),f(W),y("Cash collected — settle the amount in your wallet"),r.invalidateQueries({queryKey:["partner-wallet"]})},onError:g=>y(g instanceof Error?g.message:"Payment collection failed","error")}),M=G({mutationFn:()=>q.settleCash(e.id),onSuccess:({order:g,payment:W})=>{D(g),f(W),y("Cash settlement complete"),r.invalidateQueries({queryKey:["partner-wallet"]}),r.invalidateQueries({queryKey:["partner","active-job"]})},onError:g=>y(g instanceof Error?g.message:"Cash settlement failed","error")}),U=G({mutationFn:()=>q.requestDeliveryOtp(e.id),onSuccess:g=>{m(!0),y(g!=null&&g.active?"An active OTP is already available. Ask the customer for the OTP shown on their order.":"OTP sent. Ask the customer for the latest 6-digit OTP.")},onError:g=>y(g instanceof Error?g.message:"Could not send OTP","error")}),F=G({mutationFn:()=>q.verifyDeliveryOtp(e.id,d),onSuccess:async g=>{if(l(""),m(!0),D(g),y("Delivery OTP verified"),!C(g)){y("Collect and settle the cash, then mark the order as delivered.","info");return}try{const W=await q.updateOrderStatus(g.id,"delivered");D(W),y("Order delivered"),r.invalidateQueries({queryKey:["partner-orders"]}),r.invalidateQueries({queryKey:["partner-earnings"]}),r.invalidateQueries({queryKey:["partner-wallet"]}),r.invalidateQueries({queryKey:["partner","active-job"]})}catch(W){y(W instanceof Error?W.message:"Could not complete the delivery","error"),r.invalidateQueries({queryKey:["partner","active-job"]})}},onError:g=>y(g instanceof Error?g.message:"OTP verification failed","error")});if(p.useEffect(()=>{(e==null?void 0:e.status)==="ARRIVED"&&!e.delivery_otp_verified_at&&!b.current&&(b.current=!0,q.requestDeliveryOtp(e.id).then(()=>m(!0)).catch(()=>{}))},[e]),!e||typeof e.status!="string")return null;const Q=e.status.toUpperCase(),Ae=["cash_on_delivery","cod"].includes((e.payment_method??"").toLowerCase()),xe=e.payment_status==="paid",N=!!e.delivery_payment_collected_at,Y=!!e.delivery_payment_settled_at,k=N&&!Y,ee=Ae&&!xe&&!N,ie=xe||N,wt=!!e.delivery_otp_verified_at,De=(u==null?void 0:u.settlement)==="pending"?Math.max(0,Math.ceil(u.shortfall||0)):0,Ds=async()=>{if(a)try{await O.mutateAsync(),y("Proof uploaded")}catch{return}x.mutate("delivered")},jn=Q==="PARTNER_ASSIGNED"?"picked_up":Q==="PICKED_UP"?"out_for_delivery":Q==="OUT_FOR_DELIVERY"?"arrived":null;return Q==="DELIVERED"||Q==="CANCELLED"?n.jsxs(V,{className:t?"bg-ink-50/40 p-3 ring-1 ring-ink-100":"ring-2 ring-brand-600/30",children:[n.jsxs("div",{className:"mb-3 flex items-center justify-between gap-2",children:[n.jsxs("div",{children:[n.jsx("p",{className:"text-xs font-semibold uppercase tracking-wide text-brand-700",children:t?"This stop":"Active delivery"}),n.jsx("p",{className:"font-bold text-neutral-900",children:e.order_number})]}),n.jsx(ae,{status:Q})]}),n.jsx(Zt,{steps:cr,current:Q}),n.jsxs("div",{className:"mt-3 rounded-xl bg-ink-50 px-3 py-2 text-sm",children:[n.jsx("p",{className:"font-medium text-neutral-900",children:Q==="DELIVERED"?"Delivered — nothing more to do for this order.":"This order was cancelled."}),n.jsx("p",{className:"mt-0.5 text-xs text-neutral-500",children:Xt(e.address)})]})]}):n.jsxs(V,{className:t?"bg-ink-50/40 p-3 ring-1 ring-ink-100":"ring-2 ring-brand-600/30",children:[n.jsxs("div",{className:"mb-4 flex items-center justify-between gap-2",children:[n.jsxs("div",{children:[n.jsx("p",{className:"text-xs font-semibold uppercase tracking-wide text-brand-700",children:t?"This stop":"Active delivery"}),n.jsx("p",{className:"font-bold text-neutral-900",children:e.order_number})]}),n.jsx(ae,{status:e.status})]}),n.jsx(Zt,{steps:cr,current:Q}),!t&&n.jsx(Xe,{apiKey:$,origin:at(e.vendor),destination:at(e.address),showDriver:!0,className:"mt-4 h-48 w-full overflow-hidden rounded-xl ring-1 ring-ink-100",labels:{origin:((_n=e.vendor)==null?void 0:_n.business_name)??"Store",destination:"Customer"}}),n.jsxs("div",{className:"mt-4 space-y-3 text-sm",children:[n.jsxs("div",{className:"rounded-xl bg-ink-50 px-3 py-2",children:[n.jsx("p",{className:"text-xs font-semibold uppercase text-neutral-400",children:"Pickup"}),n.jsx("p",{className:"font-medium text-neutral-900",children:((Nn=e.vendor)==null?void 0:Nn.business_name)??"Vendor"}),((kn=e.vendor)==null?void 0:kn.address)&&n.jsx("p",{className:"text-xs text-neutral-500",children:e.vendor.address})]}),n.jsxs("div",{className:"rounded-xl bg-ink-50 px-3 py-2",children:[n.jsx("p",{className:"text-xs font-semibold uppercase text-neutral-400",children:"Drop"}),n.jsx("p",{className:"font-medium text-neutral-900",children:Xt(e.address)})]}),((Sn=e.user)==null?void 0:Sn.name)&&n.jsxs("div",{className:"rounded-xl bg-ink-50 px-3 py-2",children:[n.jsx("p",{className:"text-xs font-semibold uppercase text-neutral-400",children:"Customer"}),n.jsxs("div",{className:"flex items-center justify-between gap-2",children:[n.jsxs("div",{className:"min-w-0",children:[n.jsx("p",{className:"truncate font-medium text-neutral-900",children:e.user.name}),n.jsx("p",{className:e.user.phone?"truncate text-xs text-neutral-500":"truncate text-xs text-neutral-400",children:e.user.phone??"Phone number unavailable"})]}),e.user.phone&&n.jsxs("a",{href:`tel:${e.user.phone.replace(/[^+\d]/g,"")}`,"aria-label":`Call ${e.user.name}`,className:"flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90",children:[n.jsx(_a,{className:"h-3.5 w-3.5"}),"Call"]})]})]}),(()=>{const g=Ns(e.vendor,e);return g?n.jsx("a",{href:g,target:"_blank",rel:"noreferrer noopener",className:"block rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-center text-xs font-semibold text-brand-700 hover:bg-brand-100",children:"Open shortest route on Google Maps"}):null})()]}),n.jsxs("div",{className:"mt-3 space-y-1",children:[(En=e.items)==null?void 0:En.map((g,W)=>n.jsxs("div",{className:"flex justify-between text-sm",children:[n.jsxs("span",{className:"text-neutral-700",children:[g.product_name," ×",g.quantity]}),n.jsx("span",{className:"font-medium",children:X(g.line_total??0)})]},g.id??`${g.product_name}-${W}`)),n.jsxs("div",{className:"flex justify-between border-t border-ink-100 pt-2 text-sm font-semibold text-neutral-900",children:[n.jsx("span",{children:"Total"}),n.jsx("span",{children:X(e.total_amount??0)})]})]}),n.jsxs("div",{className:"mt-4",children:[jn?n.jsx(E,{className:"w-full",disabled:x.isPending,onClick:()=>x.mutate(jn),children:x.isPending?"Updating…":Q==="PARTNER_ASSIGNED"?"I've picked up":Q==="PICKED_UP"?"Out for delivery":"Reached location"}):n.jsxs("div",{className:"space-y-3",children:[ee&&n.jsxs("div",{className:"rounded-xl bg-ink-50 p-3",children:[n.jsx("p",{className:"text-xs font-semibold uppercase tracking-wide text-neutral-500",children:"Collect payment"}),n.jsx("p",{className:"mt-0.5 text-lg font-bold text-neutral-900",children:X(e.total_amount??0)}),n.jsx("p",{className:"mt-0.5 text-xs text-neutral-500",children:"Cash on delivery — collect the amount from the customer."}),n.jsx("div",{className:"mt-2 flex gap-2",children:n.jsx(E,{className:"flex-1",disabled:v.isPending||x.isPending,onClick:()=>v.mutate(),children:v.isPending?"Recording…":"Collect cash"})})]}),xe&&!N&&n.jsxs("div",{className:"rounded-xl bg-emerald-50 p-3",children:[n.jsx("p",{className:"text-sm font-semibold text-emerald-700",children:"Payment received online"}),n.jsx("p",{className:"mt-0.5 text-xs text-emerald-600",children:"No cash to collect — the customer paid on the app."})]}),k&&n.jsxs("div",{className:"rounded-xl bg-amber-50 p-3",children:[n.jsx("p",{className:"text-xs font-semibold uppercase tracking-wide text-amber-700",children:"Cash collected — settlement pending"}),n.jsxs("p",{className:"mt-1 text-sm text-neutral-700",children:["Settle ",T((u==null?void 0:u.required)??e.total_amount??0)," of collected cash from your wallet balance."]}),n.jsxs("div",{className:"mt-2 flex gap-2",children:[n.jsxs(E,{variant:"secondary",className:"flex-1",disabled:v.isPending||M.isPending,onClick:()=>I(!0),children:["Add ",De>0?T(De):"money"]}),n.jsx(E,{variant:"outline",className:"flex-1",disabled:M.isPending||((u==null?void 0:u.settlement)??"pending")!=="pending"||De>0,onClick:()=>M.mutate(),children:M.isPending?"Settling…":"Mark settled"})]}),n.jsxs("p",{className:"mt-1.5 text-xs text-neutral-500",children:["Shortfall ",T(De)," · Wallet balance ",T((u==null?void 0:u.wallet_balance)??0)]}),De>0&&n.jsx("p",{className:"mt-1 text-xs text-neutral-500",children:"Add money to your wallet first, then settle."})]}),!wt&&n.jsxs("div",{className:"rounded-xl bg-ink-50 p-3",children:[n.jsx("p",{className:"text-xs font-semibold uppercase tracking-wide text-neutral-500",children:"Delivery verification"}),n.jsx("p",{className:"mt-0.5 text-xs text-neutral-500",children:"Ask the customer for the 6-digit OTP sent to their phone."}),h&&n.jsx("p",{className:"mt-1 text-xs font-medium text-emerald-600",children:"OTP sent to the customer"}),n.jsxs("div",{className:"mt-2 flex gap-2",children:[n.jsx(S,{inputMode:"numeric",maxLength:6,placeholder:"••••••",value:d,onChange:g=>l(g.target.value.replace(/\D/g,"")),className:"w-32 font-mono tracking-[0.3em]"}),n.jsx(E,{className:"flex-1",disabled:d.length!==6||F.isPending,onClick:()=>F.mutate(),children:F.isPending?"Verifying…":"Verify OTP"})]}),n.jsx("button",{type:"button",className:"mt-2 text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50",disabled:U.isPending||F.isPending,onClick:()=>U.mutate(),children:U.isPending?"Sending…":"Resend OTP"})]}),n.jsxs("label",{className:"flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-ink-200 px-3 py-2 text-sm text-neutral-600",children:[a?a.name:"Add delivery proof photo (optional)",n.jsx("input",{type:"file",accept:"image/*",className:"hidden",onChange:g=>{var W;return i(((W=g.target.files)==null?void 0:W[0])??null)}})]}),n.jsx(S,{placeholder:"Delivery note (optional)",value:o,onChange:g=>c(g.target.value)}),n.jsx(E,{className:"w-full",disabled:x.isPending||k||!ie||!wt,onClick:()=>void Ds(),children:x.isPending?"Marking delivered…":"Mark as delivered"}),k?n.jsx("p",{className:"text-center text-xs text-amber-600",children:"Settlement pending — add money to your wallet to unlock delivery."}):ie?wt?null:n.jsx("p",{className:"text-center text-xs text-neutral-400",children:"Verify the customer delivery OTP to mark this order as delivered."}):n.jsx("p",{className:"text-center text-xs text-neutral-400",children:"Collect the payment to unlock the delivery OTP step."})]}),n.jsx(yn,{open:j,onClose:()=>I(!1),label:"Add money to settle the cash you collected.",suggested:De,onCredited:()=>{v.mutateAsync()}})]})]})}const Es={new_order:"/sounds/new_order.mp3",notification:"/sounds/notification.mp3"},Lc=.55,dr=new Map;function Cs(e){let t=dr.get(e);return t||(t=new Audio(Es[e]),t.preload="auto",t.volume=Lc,dr.set(e,t)),t}let ur=!1,$t=!1;function Bc(e){const t=Cs(e),r=t.volume;t.volume=0;const s=t.play();s!==void 0&&s.then(()=>{t.pause(),t.currentTime=0}).catch(()=>{}).finally(()=>{t.volume=r})}function qc(){if(ur||$t)return;const e=()=>{$t||($t=!0,t(),Object.keys(Es).forEach(Bc))},t=()=>{window.removeEventListener("pointerdown",e,{capture:!0}),window.removeEventListener("keydown",e,{capture:!0}),window.removeEventListener("touchstart",e,{capture:!0})};ur=!0,window.addEventListener("pointerdown",e,{capture:!0}),window.addEventListener("keydown",e,{capture:!0}),window.addEventListener("touchstart",e,{capture:!0})}const Vc=2500,Hc=500;let Ft=0,Lt=null;function mr(e){const t=Cs(e);try{t.currentTime=0}catch{}const r=t.play();r!==void 0&&r.catch(()=>{})}function Kc(e){if(typeof window>"u")return;qc();const t=Date.now();if(t-Ft>=Vc){Ft=t,mr(e);return}Lt===null&&(Lt=window.setTimeout(()=>{Lt=null,Ft=Date.now(),mr(e)},Hc))}const He=new Map,zc=16;function Uc(e){let t=He.get(e);for(t||(t={seeded:!1,seen:new Set},He.set(e,t));He.size>zc;){const r=He.keys().next().value;if(typeof r!="string"||r===e)break;He.delete(r)}return t}function Wc(e,t,r){const s=p.useRef(e);e!==s.current&&(s.current=e);const a=(e??[]).map(i=>String(i.id)).join("|");p.useEffect(()=>{if(!r)return;const i=s.current;if(!i)return;const o=Uc(r);if(!o.seeded){for(const c of i)o.seen.add(String(c.id));o.seeded=!0;return}for(const c of i){const d=String(c.id);o.seen.has(d)||(o.seen.add(d),Kc(t))}},[a,r,t])}function Gc(){const[e,t]=p.useState(()=>Date.now());return p.useEffect(()=>{const r=window.setInterval(()=>t(Date.now()),1e3);return()=>window.clearInterval(r)},[]),e}function Qc({expiresAt:e}){const t=Gc();if(!e)return null;const r=Math.max(0,Math.ceil((new Date(e).getTime()-t)/1e3)),s=r<=30;return n.jsxs("span",{className:`inline-flex items-center gap-1 text-xs font-medium ${s?"text-red-600":"text-neutral-500"}`,children:[n.jsx(fa,{className:"h-3.5 w-3.5"}),r>0?`${r}s left`:"Expired"]})}function hr(e){var r;const t=(r=e==null?void 0:e.meta)==null?void 0:r.estimated_partner_earning;return typeof t=="number"&&Number.isFinite(t)?t:null}function pr(e){var a,i;const t=(a=e==null?void 0:e.meta)==null?void 0:a.customer_delivery_fee;if(typeof t=="number"&&Number.isFinite(t))return t;const r=(i=e==null?void 0:e.order)==null?void 0:i.delivery_fee,s=typeof r=="string"?Number(r):typeof r=="number"?r:NaN;return Number.isFinite(s)?s:null}function wn(){return R(t=>t.role)==="delivery_partner"?n.jsx(Jc,{}):n.jsx(Yc,{})}function Yc(){const e=de(),[t,r]=p.useState(null),s=Je(),{data:a,isLoading:i,isError:o,refetch:c}=te({queryKey:["driver-requests"],queryFn:()=>z.incomingRequests(),refetchInterval:15e3}),d=a??[],l=(h,m)=>{r(h),(m?z.acceptRequest(h):z.rejectRequest(h)).then(f=>{m&&f?(se.getState().setActiveRide(f),y("Ride accepted")):y("Request rejected"),e.invalidateQueries({queryKey:["driver-requests"]})}).catch(f=>y(f instanceof Error?f.message:"Failed","error")).finally(()=>r(null))};return i?n.jsxs(V,{className:"flex items-center justify-center py-10 text-neutral-400",children:[n.jsx(ct,{className:"h-5 w-5 animate-spin"})," Checking for ride requests…"]}):o?n.jsx(we,{onRetry:()=>void c()}):d.length===0?n.jsxs(V,{className:"flex flex-col items-center justify-center gap-2 py-12 text-center",children:[n.jsx("p",{className:"font-medium text-neutral-700",children:"No ride requests right now"}),n.jsx("p",{className:"text-sm text-neutral-400",children:"New requests appear here in real time while you're online."})]}):n.jsx("div",{className:"grid gap-4 md:grid-cols-2",children:d.map(h=>{var u;const m=h.ride;return n.jsxs(V,{className:"flex flex-col gap-3",children:[n.jsxs("div",{className:"flex items-start justify-between gap-2",children:[n.jsxs("div",{children:[n.jsx("p",{className:"font-bold text-neutral-900",children:m.ride_number}),n.jsxs("p",{className:"text-xs text-neutral-400",children:[((u=m.vehicle_type)==null?void 0:u.name)??"Ride"," · ",Number(h.distance_km??0).toFixed(1)," km away"]})]}),n.jsx("span",{className:"rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200",children:X(m.estimated_fare??0)})]}),n.jsxs("div",{className:"space-y-1.5 text-sm",children:[n.jsxs("div",{className:"flex items-start gap-2",children:[n.jsx("span",{className:"mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500"}),n.jsx("span",{className:"text-neutral-700",children:m.pickup_address??"Pickup point"})]}),n.jsxs("div",{className:"flex items-start gap-2",children:[n.jsx("span",{className:"mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600"}),n.jsx("span",{className:"text-neutral-700",children:m.destination_address??"Destination"})]})]}),n.jsx(Xe,{apiKey:s,origin:ws(m),destination:js(m),showDriver:!0,className:"h-40 w-full overflow-hidden rounded-xl ring-1 ring-ink-100",labels:{origin:"Pickup",destination:"Drop"}}),n.jsxs("div",{className:"flex items-center justify-between text-xs text-neutral-500",children:[n.jsxs("span",{children:[Number(m.distance_km??0).toFixed(1)," km · ~",m.duration_min??"—"," min"]}),n.jsx("span",{className:"capitalize",children:m.payment_method??"—"})]}),n.jsxs("div",{className:"mt-auto grid grid-cols-2 gap-2",children:[n.jsx(E,{variant:"success",size:"sm",disabled:t===h.id,onClick:()=>l(h.id,!0),children:t===h.id?"Accepting…":"Accept"}),n.jsx(E,{variant:"danger",size:"sm",disabled:t===h.id,onClick:()=>l(h.id,!1),children:"Decline"})]})]},h.id)})})}function Jc(){const e=de(),t=R(m=>m.profile),[r,s]=p.useState(null),a=Je(),{data:i,isLoading:o,isError:c,refetch:d}=te({queryKey:["partner-orders"],queryFn:()=>q.incomingOrders(),refetchInterval:15e3}),l=i??[];Wc(o?void 0:l,"notification",t!=null&&t.id?`dp:${t.id}`:"");const h=(m,u)=>{s(m),(u?q.acceptOrder(m):q.rejectOrder(m)).then(j=>{e.invalidateQueries({queryKey:["partner-orders"]}),u&&(j!=null&&j.order)?(se.getState().setActiveOrder(j.order),y("Delivery accepted")):u?(y("This order was just taken by another partner","error"),e.invalidateQueries({queryKey:["partner-orders"]})):y("Delivery declined")}).catch(j=>{if(u){const I=j instanceof Error?j.message:"Failed";y(I,"error"),e.invalidateQueries({queryKey:["partner-orders"]})}else y("Delivery declined")}).finally(()=>s(null))};return o?n.jsxs(V,{className:"flex items-center justify-center py-10 text-neutral-400",children:[n.jsx(ct,{className:"h-5 w-5 animate-spin"})," Checking for deliveries…"]}):c?n.jsx(we,{onRetry:()=>void d()}):l.length===0?n.jsxs(V,{className:"flex flex-col items-center justify-center gap-2 py-12 text-center",children:[n.jsx("p",{className:"font-medium text-neutral-700",children:"No deliveries right now"}),n.jsx("p",{className:"text-sm text-neutral-400",children:"New orders appear here in real time while you're online."})]}):n.jsx("div",{className:"grid gap-4 md:grid-cols-2",children:l.map(m=>{var I,b;const u=m.order,f=hc(u.vendor),j=Ns(u.vendor,u);return n.jsxs(V,{className:"flex flex-col gap-3",children:[n.jsxs("div",{className:"flex items-start justify-between gap-2",children:[n.jsxs("div",{children:[n.jsx("p",{className:"font-bold text-neutral-900",children:u.order_number}),n.jsxs("p",{className:"text-xs text-neutral-400",children:[((I=u.vendor)==null?void 0:I.business_name)??"Vendor"," · ",Number(m.distance_km??0).toFixed(1)," km away"]})]}),n.jsxs("div",{className:"flex flex-col items-end gap-1",children:[hr(m)!==null&&n.jsxs("span",{className:"rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200",children:["Your earning ",X(hr(m))]}),pr(m)!==null&&n.jsxs("span",{className:"text-[11px] text-neutral-400",children:["Customer delivery fee: ",X(pr(m))]}),n.jsx(Qc,{expiresAt:m.expires_at})]})]}),n.jsxs("div",{className:"space-y-1.5 text-sm",children:[n.jsxs("div",{className:"flex items-start gap-2",children:[n.jsx("span",{className:"mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600"}),n.jsx("span",{className:"text-neutral-700",children:f}),j&&n.jsx("a",{href:j,target:"_blank",rel:"noreferrer noopener",className:"mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800",children:"Route on Maps"})]}),n.jsxs("div",{className:"flex items-start gap-2",children:[n.jsx("span",{className:"mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500"}),n.jsx("span",{className:"text-neutral-700",children:Xt(u.address)})]})]}),n.jsx(Xe,{apiKey:a,origin:at(u.vendor),destination:at(u.address),showDriver:!0,className:"h-40 w-full overflow-hidden rounded-xl ring-1 ring-ink-100",labels:{origin:f||"Store",destination:"Customer"}}),n.jsx("p",{className:"border-t border-ink-100 pt-2 text-sm text-neutral-700",children:(b=u.items)==null?void 0:b.map($=>`${$.product_name} ×${$.quantity}`).join(", ")}),u.customer_note&&n.jsxs("p",{className:"text-xs text-neutral-500",children:['Note · "',u.customer_note,'"']}),n.jsxs("div",{className:"mt-auto grid grid-cols-2 gap-2",children:[n.jsx(E,{variant:"success",size:"sm",disabled:r===m.id,onClick:()=>h(m.id,!0),children:r===m.id?"Accepting…":"Accept"}),n.jsx(E,{variant:"danger",size:"sm",disabled:r===m.id,onClick:()=>h(m.id,!1),children:"Decline"})]})]},m.id)})})}function Xc(){return R(t=>t.role)==="delivery_partner"?n.jsx(td,{}):n.jsx(ed,{})}function Zc(){const e=de(),{profile:t,role:r,setOnline:s}=R(),a=r==="delivery_partner"?q:z,i=G({mutationFn:async()=>{if(!((t==null?void 0:t.is_online)??!1)){const c=await ln();await a.updateLocation(c.latitude,c.longitude)}return a.toggleAvailability()},onSuccess:o=>{s(o.is_online),y(o.is_online?"You are now online":"You are offline"),e.invalidateQueries()},onError:o=>y(o instanceof Error?o.message:"Update failed","error")});return{isOnline:(t==null?void 0:t.is_online)??!1,busy:(t==null?void 0:t.is_busy)??!1,toggle:()=>i.mutate(),pending:i.isPending}}function Is(){const{isOnline:e,busy:t,toggle:r,pending:s}=Zc();return n.jsxs(E,{variant:e?"outline":"success",disabled:s||t,onClick:r,className:e?"text-ink-700":"",children:[e?n.jsx(Ca,{className:"h-4 w-4"}):n.jsx(Ia,{className:"h-4 w-4"}),t?"On a job…":e?"Go offline":"Go online"]})}function ed(){const{data:e,isLoading:t}=te({queryKey:["driver-earnings"],queryFn:()=>z.earnings()});return n.jsxs(n.Fragment,{children:[n.jsx(Ye,{title:"Driver dashboard",description:"Accept rides and manage your availability",actions:n.jsx(Is,{})}),n.jsxs("div",{className:"mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4",children:[n.jsx(H,{label:"Today",value:X((e==null?void 0:e.today)??0),icon:ce,tone:"brand",sub:"Earned today"}),n.jsx(H,{label:"This week",value:X((e==null?void 0:e.this_week)??0),icon:ce,tone:"success"}),n.jsx(H,{label:"Total earned",value:X((e==null?void 0:e.total)??0),icon:ce,tone:"violet"}),n.jsx(H,{label:"Total trips",value:an((e==null?void 0:e.total_trips)??0),icon:ce,tone:"accent"})]}),n.jsx("div",{className:"mb-6",children:t?n.jsx(bn,{className:"p-6",rows:2}):n.jsx(vn,{})}),n.jsx("h2",{className:"mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400",children:"Incoming ride requests"}),n.jsx(wn,{})]})}function td(){const{data:e,isLoading:t}=te({queryKey:["partner-earnings"],queryFn:()=>q.earnings()});return n.jsxs(n.Fragment,{children:[n.jsx(Ye,{title:"Delivery dashboard",description:"Accept deliveries and manage your availability",actions:n.jsx(Is,{})}),n.jsxs("div",{className:"mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4",children:[n.jsx(H,{label:"Today",value:X((e==null?void 0:e.today)??0),icon:le,tone:"brand",sub:"Earned today"}),n.jsx(H,{label:"This week",value:X((e==null?void 0:e.this_week)??0),icon:le,tone:"success"}),n.jsx(H,{label:"Total earned",value:X((e==null?void 0:e.total)??0),icon:le,tone:"violet"}),n.jsx(H,{label:"Total deliveries",value:an((e==null?void 0:e.total_deliveries)??0),icon:le,tone:"accent"})]}),n.jsx("div",{className:"mb-6",children:t?n.jsx(bn,{className:"p-6",rows:2}):n.jsx(vn,{})}),n.jsx("h2",{className:"mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400",children:"Incoming deliveries"}),n.jsx(wn,{})]})}function nd(){const e=R(i=>i.role),t=R(i=>i.profile),r=t&&"service_type"in t?t.service_type:null,s=e==="delivery_partner"?r==="grocery"?"Grocery deliveries":r==="food"?"Food deliveries":"Incoming deliveries":"Ride requests",a=e==="delivery_partner"?r==="grocery"?"Grocery orders waiting to be accepted":r==="food"?"Food orders waiting to be accepted":"Delivery orders waiting to be accepted":"Ride requests waiting to be accepted";return n.jsx(Ye,{title:s,description:a,children:n.jsxs("div",{className:"space-y-6",children:[n.jsx(vn,{}),n.jsx(wn,{})]})})}const gt=p.forwardRef(({className:e="",children:t,...r},s)=>n.jsx("table",{ref:s,className:`w-full text-left text-sm ${e}`,...r,children:t}));gt.displayName="Table";const bt=p.forwardRef(({className:e="",children:t,...r},s)=>n.jsx("thead",{ref:s,className:e,...r,children:t}));bt.displayName="THead";const yt=p.forwardRef(({className:e="",children:t,...r},s)=>n.jsx("tr",{ref:s,className:`border-b border-ink-100 bg-ink-50/50 ${e}`,...r,children:t}));yt.displayName="THeadRow";const K=p.forwardRef(({className:e="",children:t,...r},s)=>n.jsx("th",{ref:s,className:`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 ${e}`,...r,children:t}));K.displayName="THeadCell";const vt=p.forwardRef(({className:e="",children:t,...r},s)=>n.jsx("tbody",{ref:s,className:`divide-y divide-ink-100 ${e}`,...r,children:t}));vt.displayName="TBody";const pe=p.forwardRef(({className:e="",clickable:t,selected:r,children:s,...a},i)=>n.jsx("tr",{ref:i,className:`${t?"cursor-pointer transition-colors hover:bg-ink-50/60":""} ${r?"bg-brand-50/60":""} ${e}`,...a,children:s}));pe.displayName="TRow";const B=p.forwardRef(({className:e="",children:t,...r},s)=>n.jsx("td",{ref:s,className:`whitespace-nowrap px-4 py-3 text-neutral-700 ${e}`,...r,children:t}));B.displayName="TCell";function Ts({page:e,lastPage:t,total:r,onChange:s}){return t<=1?null:n.jsxs("div",{className:"flex items-center justify-between border-t border-ink-100 px-4 py-3",children:[n.jsxs("p",{className:"text-sm text-neutral-500",children:[r," record",r===1?"":"s"," · page ",e," of ",t]}),n.jsxs("div",{className:"flex items-center gap-1",children:[n.jsx("button",{disabled:e<=1,onClick:()=>s(e-1),className:"inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-neutral-600 hover:bg-ink-50 disabled:opacity-40",children:n.jsx(ha,{className:"h-4 w-4"})}),n.jsx("button",{disabled:e>=t,onClick:()=>s(e+1),className:"inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-neutral-600 hover:bg-ink-50 disabled:opacity-40",children:n.jsx(pa,{className:"h-4 w-4"})})]})]})}const fr=["overview","transactions","payouts"],rd=[{value:"",label:"All services"},{value:"food",label:"Food"},{value:"grocery",label:"Grocery"},{value:"ride",label:"Rides"}],sd=[{value:"",label:"Both directions"},{value:"credit",label:"Credits"},{value:"debit",label:"Debits"}];function ad(){var U;const e=R(F=>F.role),t=e==="delivery_partner"?q:z,r=e==="delivery_partner"?"partner":"driver",s=e==="delivery_partner",[a,i]=qs(),o=a.get("tab"),c=fr.includes(o)?o:"overview",d=F=>{F==="overview"?i({},{replace:!0}):i({tab:F},{replace:!0})},[l,h]=p.useState(1),[m,u]=p.useState(1),[f,j]=p.useState(""),[I,b]=p.useState(""),[$,D]=p.useState(!1),C=te({queryKey:[`${r}-earnings`],queryFn:()=>t.earnings(),refetchOnMount:"always"}),x=te({queryKey:[`${r}-wallet`],queryFn:()=>t.wallet(),refetchOnMount:"always"}),O=te({queryKey:[`${r}-wallet-transactions`,f,I,l],queryFn:()=>t.walletTransactions({service:f||void 0,direction:I||void 0,page:l,per_page:15}),enabled:c==="transactions"}),v=te({queryKey:[`${r}-payouts`,m],queryFn:()=>t.withdrawals({page:m,per_page:15}),enabled:c==="payouts"}),M=(U=C.data)==null?void 0:U.payout;return n.jsxs(Ye,{title:"Earnings & Wallet",description:"Your earnings, wallet transactions and payouts",actions:n.jsx("div",{className:"flex rounded-xl border border-ink-100 bg-white p-1",children:fr.map(F=>n.jsx("button",{type:"button",onClick:()=>d(F),"aria-current":c===F?"page":void 0,className:`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${c===F?"bg-brand-600 text-white":"text-neutral-600 hover:bg-ink-50"}`,children:F},F))}),children:[c==="overview"&&n.jsx(id,{earnings:C.data,wallet:x.data,isLoading:C.isLoading||x.isLoading,isError:C.isError||x.isError,onRetry:()=>{C.refetch(),x.refetch()},isPartner:s,onAddMoney:s?()=>D(!0):void 0}),c==="transactions"&&n.jsx(od,{wallet:x.data,isLoading:x.isLoading,isError:x.isError,onRetryWallet:()=>void x.refetch(),service:f,direction:I,onService:F=>{j(F),h(1)},onDirection:F=>{b(F),h(1)},onAddMoney:s?()=>D(!0):void 0,transactions:O.data,isLoadingTx:O.isLoading,isErrorTx:O.isError,onRetryTx:()=>void O.refetch(),txPage:l,onTxPage:h}),c==="payouts"&&n.jsx(ld,{payout:M,isLoading:C.isLoading,isError:C.isError,onRetry:()=>void C.refetch(),payouts:v.data,isLoadingPayouts:v.isLoading,isErrorPayouts:v.isError,onRetryPayouts:()=>void v.refetch(),onPayoutPage:u}),n.jsx(yn,{open:$,onClose:()=>D(!1),label:"Top up your wallet using UPI.",onCredited:()=>{x.refetch(),C.refetch(),O.refetch()}})]})}function id({earnings:e,wallet:t,isLoading:r,isError:s,onRetry:a,isPartner:i,onAddMoney:o}){if(s)return n.jsx(V,{className:"px-0 py-8",children:n.jsx(we,{onRetry:a})});if(r)return n.jsxs("div",{className:"mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",children:[n.jsx(Z,{}),n.jsx(Z,{}),n.jsx(Z,{}),n.jsx(Z,{}),n.jsx(Z,{}),n.jsx(Z,{})]});const c=e==null?void 0:e.payout;return n.jsxs(n.Fragment,{children:[n.jsxs("div",{className:"mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",children:[n.jsx(H,{dense:!0,label:"Wallet balance",value:T((t==null?void 0:t.balance)??0),icon:Ue,tone:"success"}),n.jsx(H,{dense:!0,label:"Total earned",value:T((t==null?void 0:t.total_earned)??0),icon:lt,tone:"accent"}),n.jsx(H,{dense:!0,label:"Today",value:T((e==null?void 0:e.today)??0),icon:Sa,tone:"brand"}),n.jsx(H,{dense:!0,label:i?"Deliveries":"Trips",value:an((e==null?void 0:e.total_deliveries)??(e==null?void 0:e.total_trips)??0),icon:le,tone:"accent"}),c&&n.jsx(H,{dense:!0,label:"Minimum wallet balance",value:T(c.minimum_wallet_balance),icon:Dr,tone:"violet",sub:"Must remain after payout"}),c&&n.jsx(H,{dense:!0,label:"Available to withdraw",value:T(c.available_withdrawable_amount),icon:rn,tone:"slate"})]}),o&&n.jsx("div",{className:"mb-6 flex justify-end",children:n.jsxs(E,{size:"sm",variant:"secondary",onClick:o,children:[n.jsx(Tr,{className:"h-4 w-4"})," Add money"]})}),i&&n.jsxs("div",{children:[n.jsx("h3",{className:"mb-3 text-sm font-semibold text-neutral-700",children:"Delivery earnings"}),n.jsx(V,{className:"px-0 py-0",children:n.jsx(cd,{earnings:e})})]})]})}function od({wallet:e,isLoading:t,isError:r,onRetryWallet:s,service:a,direction:i,onService:o,onDirection:c,onAddMoney:d,transactions:l,isLoadingTx:h,isErrorTx:m,onRetryTx:u,txPage:f,onTxPage:j}){return n.jsxs(n.Fragment,{children:[n.jsx("h3",{className:"mb-3 text-sm font-semibold text-neutral-700",children:"Wallet"}),n.jsx("p",{className:"-mt-2 mb-3 text-xs text-neutral-500",children:"Your earnings balance and transaction history"}),r?n.jsx(V,{className:"mb-6 px-0 py-8",children:n.jsx(we,{onRetry:s})}):t?n.jsxs("div",{className:"mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5",children:[n.jsx(Z,{}),n.jsx(Z,{}),n.jsx(Z,{}),n.jsx(Z,{}),n.jsx(Z,{})]}):n.jsxs("div",{className:"mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5",children:[n.jsx(H,{label:"Available balance",value:T((e==null?void 0:e.available_balance)??0),icon:Ue,tone:"brand"}),n.jsx(H,{label:"Wallet balance",value:T((e==null?void 0:e.balance)??0),icon:Ue,tone:"success"}),n.jsx(H,{label:"Pending transfers",value:T((e==null?void 0:e.pending_balance)??0),icon:ua,tone:"violet"}),n.jsx(H,{label:"Total earned",value:T((e==null?void 0:e.total_earned)??0),icon:lt,tone:"accent"}),n.jsx(H,{label:"Total credited",value:T((e==null?void 0:e.total_credited)??0),icon:rn,tone:"slate"})]}),n.jsxs("div",{className:"mb-3 flex flex-wrap items-center gap-2",children:[d&&n.jsxs(E,{size:"sm",variant:"secondary",onClick:d,children:[n.jsx(Tr,{className:"h-4 w-4"})," Add money"]}),n.jsx(xr,{value:a,onChange:I=>o(I),options:rd,label:"Service"}),n.jsx(xr,{value:i,onChange:I=>c(I),options:sd,label:"Direction"})]}),n.jsxs(V,{className:"px-0 py-0",children:[h?n.jsx(As,{}):m?n.jsx(we,{onRetry:u}):n.jsx(ud,{data:l}),!h&&!m&&l&&n.jsx(Ts,{page:f,lastPage:l.last_page,total:l.total,onChange:j})]})]})}function ld({payout:e,isLoading:t,isError:r,onRetry:s,payouts:a,isLoadingPayouts:i,isErrorPayouts:o,onRetryPayouts:c,onPayoutPage:d}){return n.jsxs(n.Fragment,{children:[n.jsx("h3",{className:"mb-3 text-sm font-semibold text-neutral-700",children:"Request payout"}),r?n.jsx(V,{className:"mb-6 px-0 py-8",children:n.jsx(we,{onRetry:s})}):t?n.jsxs("div",{className:"mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3",children:[n.jsx(Z,{}),n.jsx(Z,{}),n.jsx(Z,{})]}):n.jsxs(n.Fragment,{children:[n.jsxs("div",{className:"mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3",children:[n.jsx(H,{label:"Wallet balance",value:T((e==null?void 0:e.wallet_balance)??0),icon:Ue,tone:"brand"}),n.jsx(H,{label:"Minimum wallet balance",value:T((e==null?void 0:e.minimum_wallet_balance)??0),icon:Dr,tone:"violet",sub:"Must remain after payout"}),n.jsx(H,{label:"Available to withdraw",value:T((e==null?void 0:e.available_withdrawable_amount)??0),icon:rn,tone:"slate",sub:"Maximum payout"})]}),n.jsx(hd,{available:(e==null?void 0:e.available_withdrawable_amount)??0,minimum:(e==null?void 0:e.minimum_wallet_balance)??0})]}),n.jsx("h3",{className:"mb-3 mt-8 text-sm font-semibold text-neutral-700",children:"Payout history"}),n.jsx(V,{className:"px-0 py-0",children:i?n.jsx(As,{}):o?n.jsx(we,{onRetry:c}):n.jsx(md,{data:a,onChange:d})})]})}function cd({earnings:e}){var o;const t=((o=e==null?void 0:e.earnings)==null?void 0:o.data)??[],[r,s]=p.useState(null),a=r!==null?t.find(c=>c.id===r):void 0,i=c=>s(d=>d===c?null:c);return n.jsx("div",{className:"overflow-x-auto",children:n.jsxs(gt,{children:[n.jsx(bt,{children:n.jsxs(yt,{children:[n.jsx(K,{children:"Earning №"}),n.jsx(K,{children:"Order"}),n.jsx(K,{children:"Vendor"}),n.jsx(K,{children:"Delivered to"}),n.jsx(K,{className:"text-right",children:"Earning"}),n.jsx(K,{children:"Status"}),n.jsx(K,{children:"Delivered"})]})}),n.jsxs(vt,{children:[t.length===0&&n.jsx(pe,{children:n.jsx(B,{colSpan:7,className:"text-center text-neutral-400",children:"No earnings yet."})}),t.map(c=>{const d=(a==null?void 0:a.id)===c.id;return n.jsxs(p.Fragment,{children:[n.jsxs(pe,{clickable:!0,selected:d,onClick:()=>i(c.id),"aria-expanded":d,tabIndex:0,onKeyDown:l=>{(l.key==="Enter"||l.key===" ")&&(l.preventDefault(),i(c.id))},children:[n.jsx(B,{className:"font-mono text-xs",children:n.jsxs("span",{className:"flex items-center gap-1.5",children:[n.jsx(Ir,{"aria-hidden":!0,className:`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform ${d?"rotate-180":""}`}),c.earning_number]})}),n.jsx(B,{className:"font-mono text-xs",children:c.order_number??"—"}),n.jsx(B,{className:"text-sm",children:c.vendor_name??"—"}),n.jsx(B,{className:"text-sm",children:c.delivered_to??"—"}),n.jsx(B,{className:"text-right font-medium",children:T(c.amount)}),n.jsx(B,{children:n.jsx(ae,{status:c.status})}),n.jsx(B,{className:"text-sm",children:c.delivered_at?on(c.delivered_at):"—"})]}),d&&n.jsx(pe,{children:n.jsx(B,{colSpan:7,className:"bg-ink-50/50 px-4 py-3 whitespace-normal",children:n.jsxs("div",{className:"flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-neutral-500",children:[n.jsx("span",{className:"font-medium uppercase tracking-wide text-neutral-400",children:"Selected earning"}),n.jsx("span",{className:"font-mono text-neutral-700",children:c.order_number??c.earning_number}),n.jsx(dd,{entry:c})]})})})]},c.id)})]})]})})}function dd({entry:e}){const t=e.breakdown;return t?n.jsxs("span",{className:"flex flex-wrap items-center gap-x-4 gap-y-1",children:[typeof t.distance_km=="number"&&n.jsxs("span",{children:[t.distance_km," km"]}),typeof t.customer_delivery_fee=="number"&&t.customer_delivery_fee>0&&n.jsxs("span",{children:["customer fee ",T(t.customer_delivery_fee)]}),typeof t.first_distance_earning=="number"&&t.first_distance_earning>0&&n.jsxs("span",{children:["free-distance earning ",T(t.first_distance_earning),typeof t.free_distance_km=="number"?` (first ${t.free_distance_km} km)`:""]}),typeof t.additional_admin_earning=="number"&&t.additional_admin_earning>0&&n.jsxs("span",{children:["extra-distance earning ",T(t.additional_admin_earning),typeof t.additional_distance_km=="number"?` (${t.additional_distance_km} km)`:""]}),typeof t.per_km=="number"&&n.jsxs("span",{children:["₹",t.per_km,"/km"]}),typeof t.customer_delivery_fee=="number"&&t.customer_delivery_fee===0&&n.jsxs("span",{className:"font-medium text-neutral-700",children:["Free delivery · platform funded ",T(e.amount)]}),typeof t.platform_funded=="number"&&t.platform_funded!==e.amount&&n.jsxs("span",{children:["platform funded ",T(t.platform_funded)]})]}):n.jsx("span",{className:"text-neutral-400",children:"Breakdown unavailable"})}function ud({data:e}){const t=e.data;return n.jsx("div",{className:"overflow-x-auto",children:n.jsxs(gt,{children:[n.jsx(bt,{children:n.jsxs(yt,{children:[n.jsx(K,{children:"Transaction"}),n.jsx(K,{children:"Service"}),n.jsx(K,{children:"Description"}),n.jsx(K,{children:"Amount"}),n.jsx(K,{children:"Direction"}),n.jsx(K,{children:"Date"})]})}),n.jsxs(vt,{children:[t.length===0&&n.jsx(pe,{children:n.jsx(B,{colSpan:6,className:"text-center text-neutral-400",children:"No wallet transactions yet."})}),t.map(r=>n.jsxs(pe,{children:[n.jsx(B,{className:"font-mono text-xs",children:r.type}),n.jsx(B,{className:"text-sm capitalize",children:r.service??"—"}),n.jsx(B,{className:"text-sm",children:r.description??"—"}),n.jsxs(B,{className:`text-right font-medium ${r.direction==="credit"?"text-emerald-600":"text-rose-600"}`,children:[r.direction==="credit"?"+":"−",T(r.amount)]}),n.jsx(B,{children:n.jsx(ae,{status:r.direction==="credit"?"credit":"debit"})}),n.jsx(B,{className:"text-sm",children:r.created_at?on(r.created_at):"—"})]},r.transaction_id))]})]})})}function md({data:e,onChange:t}){return n.jsxs(n.Fragment,{children:[n.jsx("div",{className:"overflow-x-auto",children:n.jsxs(gt,{children:[n.jsx(bt,{children:n.jsxs(yt,{children:[n.jsx(K,{children:"Payout"}),n.jsx(K,{children:"Bank"}),n.jsx(K,{className:"text-right",children:"Amount"}),n.jsx(K,{children:"Status"}),n.jsx(K,{children:"Requested"})]})}),n.jsxs(vt,{children:[e.data.length===0&&n.jsx(pe,{children:n.jsx(B,{colSpan:5,className:"text-center text-neutral-400",children:"No payouts yet."})}),e.data.map(r=>n.jsxs(p.Fragment,{children:[n.jsxs(pe,{children:[n.jsx(B,{className:"font-mono text-xs",children:r.payout_number}),n.jsxs(B,{className:"text-sm",children:[r.bank_name??"—",n.jsx("p",{className:"text-xs text-neutral-400",children:r.bank_ifsc??""})]}),n.jsx(B,{className:"text-right font-medium",children:X(r.amount)}),n.jsx(B,{children:n.jsx(ae,{status:r.status})}),n.jsx(B,{className:"text-sm",children:on(r.created_at)})]}),r.status==="SUCCESS"&&r.admin_remark&&n.jsx(pe,{children:n.jsx(B,{colSpan:5,className:"bg-ink-50/50",children:n.jsxs("p",{className:"whitespace-pre-wrap break-words text-xs text-neutral-600",children:[n.jsx("span",{className:"font-semibold text-neutral-700",children:"Admin remark: "}),r.admin_remark]})})})]},r.id))]})]})}),n.jsx(Ts,{page:e.current_page,lastPage:e.last_page,total:e.total,onChange:t})]})}function hd({available:e,minimum:t}){const r=R(j=>j.role),s=de(),a=r==="delivery_partner"?q:z,i=r==="delivery_partner"?"partner":"driver",[o,c]=p.useState(""),d=G({mutationFn:j=>a.requestWithdrawal(j),onSuccess:()=>{y("Withdrawal requested"),c(""),s.invalidateQueries({queryKey:[`${i}-payouts`]}),s.invalidateQueries({queryKey:[`${i}-earnings`]}),s.invalidateQueries({queryKey:[`${i}-wallet`]}),s.invalidateQueries({queryKey:[`${i}-wallet-transactions`]})},onError:j=>y(j instanceof Error?j.message:"Request failed","error")}),l=Number(o),h=e<=0,m=!!o&&l>e,u=h?`Minimum wallet balance of ${T(t)} must remain after payout. No payout amount is currently available.`:m?`Maximum payout available is ${T(e)} because ${T(t)} must remain in your wallet.`:null,f=h||m||!l||l<=0;return n.jsxs(V,{children:[n.jsxs("div",{className:"flex flex-wrap items-end gap-3",children:[n.jsxs("div",{children:[n.jsx("label",{className:"mb-1.5 block text-sm font-medium text-neutral-700",htmlFor:"payout-amount",children:"Payout amount (₹)"}),n.jsx(S,{id:"payout-amount",type:"number",min:.01,max:e,step:"1",placeholder:e>0?String(e):"0.00",value:o,disabled:h,onChange:j=>c(j.target.value),className:"w-48"})]}),n.jsxs(E,{disabled:f||d.isPending,onClick:()=>d.mutate(l),children:[n.jsx(lt,{className:"h-4 w-4"}),d.isPending?"Requesting…":"Request payout"]})]}),u&&n.jsx("p",{className:"mt-2 text-xs font-medium text-red-600",role:"alert",children:u})]})}function xr({value:e,onChange:t,options:r,label:s}){return n.jsxs("label",{className:"flex items-center gap-2 text-sm text-neutral-500",children:[n.jsx("span",{children:s}),n.jsx("select",{value:e,onChange:a=>t(a.target.value),className:"rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-neutral-700",children:r.map(a=>n.jsx("option",{value:a.value,children:a.label},a.value))})]})}function Z(){return n.jsx("div",{className:"h-24 animate-pulse rounded-2xl bg-neutral-100"})}function As(){return n.jsxs("div",{className:"space-y-3 p-6",children:[n.jsx("div",{className:"h-10 animate-pulse rounded-lg bg-neutral-100"}),n.jsx("div",{className:"h-10 animate-pulse rounded-lg bg-neutral-100"}),n.jsx("div",{className:"h-10 animate-pulse rounded-lg bg-neutral-100"})]})}function pd(){return n.jsx(br,{to:"/earnings?tab=overview",replace:!0})}const fd=["license","insurance","rc","profile_photo","aadhar"];function xd(){const t=R(l=>l.role)==="driver",r=t?"driver":"partner",s=t?z:q,{data:a,isLoading:i,isError:o,refetch:c}=te({queryKey:[`${r}-profile`],queryFn:()=>s.profile()});if(i)return n.jsx(bn,{className:"py-10"});if(o||!a)return n.jsx(we,{onRetry:()=>void c()});const d=a.is_verified??!1;return n.jsxs(n.Fragment,{children:[n.jsx(Ye,{title:"Profile & KYC",description:"Vehicle, licence and payout details",actions:n.jsx(ae,{status:d?"verified":"unverified"})}),n.jsxs("div",{className:"grid gap-6 lg:grid-cols-2",children:[t?n.jsx(gd,{data:a}):n.jsx(bd,{data:a}),n.jsxs("div",{className:"space-y-6",children:[n.jsx(yd,{}),n.jsx(vd,{}),n.jsx(wd,{})]})]})]})}function gd({data:e}){const t=de(),r=te({queryKey:["vehicle-types"],queryFn:()=>jr.list()}),[s,a]=p.useState({}),i=Object.keys(s).length>0,o=i?s:{vehicle_type_id:String(e.vehicle_type_id??""),vehicle_number:e.vehicle_number??"",vehicle_model:e.vehicle_model??"",vehicle_color:e.vehicle_color??"",license_number:e.license_number??"",license_expiry:e.license_expiry?String(e.license_expiry).slice(0,10):"",aadhar_number:e.aadhar_number??"",pan_number:e.pan_number??""},c=G({mutationFn:()=>z.update({vehicle_type_id:o.vehicle_type_id?Number(o.vehicle_type_id):void 0,vehicle_number:o.vehicle_number,vehicle_model:o.vehicle_model,vehicle_color:o.vehicle_color,license_number:o.license_number,license_expiry:o.license_expiry||void 0,aadhar_number:o.aadhar_number,pan_number:o.pan_number}),onSuccess:()=>{y("Profile updated"),a({}),t.invalidateQueries({queryKey:["driver-profile"]})},onError:l=>y(l instanceof Error?l.message:"Save failed","error")}),d=(l,h)=>a(m=>({...m,[l]:h}));return n.jsxs(V,{children:[n.jsx(Be,{className:"px-0 pt-0",children:n.jsxs(qe,{className:"flex items-center gap-2",children:[n.jsx(Cr,{className:"h-4 w-4 text-brand-600"})," Vehicle & licence"]})}),n.jsxs("div",{className:"space-y-4",children:[n.jsx(_,{label:"Vehicle type",children:n.jsxs(Se,{value:o.vehicle_type_id,onChange:l=>d("vehicle_type_id",l.target.value),children:[n.jsx("option",{value:"",children:"Select vehicle type"}),(r.data??[]).map(l=>n.jsx("option",{value:l.id,children:l.name},l.id))]})}),n.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[n.jsx(_,{label:"Vehicle number",children:n.jsx(S,{value:o.vehicle_number,onChange:l=>d("vehicle_number",l.target.value)})}),n.jsx(_,{label:"Colour",children:n.jsx(S,{value:o.vehicle_color,onChange:l=>d("vehicle_color",l.target.value)})})]}),n.jsx(_,{label:"Vehicle model",children:n.jsx(S,{value:o.vehicle_model,onChange:l=>d("vehicle_model",l.target.value)})}),n.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[n.jsx(_,{label:"Licence number",children:n.jsx(S,{value:o.license_number,onChange:l=>d("license_number",l.target.value)})}),n.jsx(_,{label:"Licence expiry",children:n.jsx(S,{type:"date",value:o.license_expiry,onChange:l=>d("license_expiry",l.target.value)})})]}),n.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[n.jsx(_,{label:"Aadhaar number",children:n.jsx(S,{value:o.aadhar_number,onChange:l=>d("aadhar_number",l.target.value)})}),n.jsx(_,{label:"PAN number",children:n.jsx(S,{value:o.pan_number,onChange:l=>d("pan_number",l.target.value.toUpperCase()),className:"uppercase"})})]}),n.jsx(E,{disabled:!i||c.isPending,onClick:()=>c.mutate(),children:c.isPending?"Saving…":"Save vehicle details"})]})]})}function bd({data:e}){const t=de(),[r,s]=p.useState({}),a=Object.keys(r).length>0,i=a?r:{vehicle_type:e.vehicle_type??"bike",vehicle_number:e.vehicle_number??"",vehicle_model:e.vehicle_model??"",vehicle_color:e.vehicle_color??"",license_number:e.license_number??"",license_expiry:e.license_expiry?String(e.license_expiry).slice(0,10):"",aadhar_number:e.aadhar_number??""},o=G({mutationFn:()=>q.update({vehicle_type:i.vehicle_type,vehicle_number:i.vehicle_number,vehicle_model:i.vehicle_model,vehicle_color:i.vehicle_color,license_number:i.license_number,license_expiry:i.license_expiry||void 0,aadhar_number:i.aadhar_number}),onSuccess:()=>{y("Profile updated"),s({}),t.invalidateQueries({queryKey:["partner-profile"]})},onError:d=>y(d instanceof Error?d.message:"Save failed","error")}),c=(d,l)=>s(h=>({...h,[d]:l}));return n.jsxs(V,{children:[n.jsx(Be,{className:"px-0 pt-0",children:n.jsxs(qe,{className:"flex items-center gap-2",children:[n.jsx(Cr,{className:"h-4 w-4 text-brand-600"})," Vehicle & licence"]})}),n.jsxs("div",{className:"space-y-4",children:[n.jsx(_,{label:"Vehicle type",children:n.jsx(Se,{value:i.vehicle_type,onChange:d=>c("vehicle_type",d.target.value),children:["bike","scooter","bicycle","car"].map(d=>n.jsx("option",{value:d,children:d},d))})}),n.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[n.jsx(_,{label:"Vehicle number",children:n.jsx(S,{value:i.vehicle_number,onChange:d=>c("vehicle_number",d.target.value)})}),n.jsx(_,{label:"Colour",children:n.jsx(S,{value:i.vehicle_color,onChange:d=>c("vehicle_color",d.target.value)})})]}),n.jsx(_,{label:"Vehicle model",children:n.jsx(S,{value:i.vehicle_model,onChange:d=>c("vehicle_model",d.target.value)})}),n.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[n.jsx(_,{label:"Licence number",children:n.jsx(S,{value:i.license_number,onChange:d=>c("license_number",d.target.value)})}),n.jsx(_,{label:"Licence expiry",children:n.jsx(S,{type:"date",value:i.license_expiry,onChange:d=>c("license_expiry",d.target.value)})})]}),n.jsx(_,{label:"Aadhaar number",children:n.jsx(S,{value:i.aadhar_number,onChange:d=>c("aadhar_number",d.target.value)})}),n.jsx(E,{disabled:!a||o.isPending,onClick:()=>o.mutate(),children:o.isPending?"Saving…":"Save vehicle details"})]})]})}function yd(){const e=de(),r=R(m=>m.role)==="driver",s=r?"driver":"partner",{profile:a}=R(),[i,o]=p.useState({}),c=Object.keys(i).length>0,d=c?i:{bank_account_name:(a==null?void 0:a.bank_account_name)??"",bank_account_number:(a==null?void 0:a.bank_account_number)??"",bank_ifsc:(a==null?void 0:a.bank_ifsc)??"",bank_name:(a==null?void 0:a.bank_name)??""},l=G({mutationFn:()=>r?z.updateBank(d):q.updateBank(d),onSuccess:()=>{y("Bank details saved"),o({}),e.invalidateQueries({queryKey:[`${s}-profile`]})},onError:m=>y(m instanceof Error?m.message:"Save failed","error")}),h=(m,u)=>o(f=>({...f,[m]:u}));return n.jsxs(V,{children:[n.jsx(Be,{className:"px-0 pt-0",children:n.jsxs(qe,{className:"flex items-center gap-2",children:[n.jsx(ya,{className:"h-4 w-4 text-brand-600"})," Payout bank details"]})}),n.jsxs("div",{className:"space-y-4",children:[n.jsx(_,{label:"Account name",children:n.jsx(S,{value:d.bank_account_name,onChange:m=>h("bank_account_name",m.target.value)})}),n.jsx(_,{label:"Account number",children:n.jsx(S,{value:d.bank_account_number,onChange:m=>h("bank_account_number",m.target.value)})}),n.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[n.jsx(_,{label:"IFSC",children:n.jsx(S,{value:d.bank_ifsc,onChange:m=>h("bank_ifsc",m.target.value.toUpperCase()),className:"font-mono uppercase"})}),n.jsx(_,{label:"Bank name",children:n.jsx(S,{value:d.bank_name,onChange:m=>h("bank_name",m.target.value)})})]}),n.jsx(E,{disabled:!c||l.isPending,onClick:()=>l.mutate(),children:l.isPending?"Saving…":"Save bank details"})]})]})}function vd(){const e=de(),r=R(h=>h.role)==="driver",{profile:s}=R(),[a,i]=p.useState(null),[o,c]=p.useState("license"),d=p.useMemo(()=>{const h=(s==null?void 0:s.documents)??[],m=new Set;return h.forEach(u=>m.add(u.type)),[...m]},[s]),l=G({mutationFn:()=>r?z.uploadDocuments([{type:o,file:a}]):q.uploadDocuments([{type:o,file:a}]),onSuccess:()=>{y("Document uploaded for verification"),i(null),e.invalidateQueries({queryKey:[`${r?"driver":"partner"}-profile`]})},onError:h=>y(h instanceof Error?h.message:"Upload failed","error")});return n.jsxs(V,{children:[n.jsx(Be,{className:"px-0 pt-0",children:n.jsxs(qe,{className:"flex items-center gap-2",children:[n.jsx(xa,{className:"h-4 w-4 text-brand-600"})," Documents & KYC"]})}),n.jsxs("div",{className:"space-y-4",children:[n.jsxs("div",{className:"flex flex-wrap gap-2",children:[d.length===0&&n.jsx("span",{className:"text-sm text-neutral-400",children:"No documents uploaded yet"}),d.map(h=>n.jsx("span",{className:"rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium capitalize text-emerald-700 ring-1 ring-inset ring-emerald-200",children:h},h))]}),n.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[n.jsx(_,{label:"Document type",children:n.jsx(Se,{value:o,onChange:h=>c(h.target.value),children:fd.map(h=>n.jsx("option",{value:h,children:h.replace(/_/g," ")},h))})}),n.jsxs("label",{className:"flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-ink-200 px-3 py-2 text-sm text-neutral-600",children:[a?a.name:"Choose file…",n.jsx("input",{type:"file",className:"hidden",onChange:h=>{var m;return i(((m=h.target.files)==null?void 0:m[0])??null)}})]})]}),n.jsx(E,{disabled:!a||l.isPending,onClick:()=>l.mutate(),children:l.isPending?"Uploading…":"Upload for verification"})]})]})}function wd(){const{user:e,profile:t}=R(),r=t==null?void 0:t.rating;return n.jsxs(V,{children:[n.jsx(Be,{className:"px-0 pt-0",children:n.jsxs(qe,{className:"flex items-center gap-2",children:[n.jsx(ba,{className:"h-4 w-4 text-brand-600"})," Account"]})}),n.jsxs("div",{className:"space-y-3 text-sm",children:[n.jsxs("div",{className:"flex justify-between border-b border-ink-100 pb-2",children:[n.jsx("span",{className:"text-neutral-500",children:"Name"}),n.jsx("span",{className:"font-medium text-neutral-900",children:(e==null?void 0:e.name)??"—"})]}),n.jsxs("div",{className:"flex justify-between border-b border-ink-100 pb-2",children:[n.jsx("span",{className:"text-neutral-500",children:"Email"}),n.jsx("span",{className:"font-medium text-neutral-900",children:(e==null?void 0:e.email)??"—"})]}),n.jsxs("div",{className:"flex justify-between border-b border-ink-100 pb-2",children:[n.jsx("span",{className:"text-neutral-500",children:"Phone"}),n.jsx("span",{className:"font-medium text-neutral-900",children:(e==null?void 0:e.phone)??"—"})]}),n.jsxs("div",{className:"flex justify-between",children:[n.jsx("span",{className:"text-neutral-500",children:"Rating"}),n.jsxs("span",{className:"font-medium text-neutral-900",children:[Number(r??0).toFixed(1)," ★"]})]})]})]})}function jd(){return n.jsxs("div",{className:"flex flex-col items-center justify-center py-24 text-center",children:[n.jsx("p",{className:"text-6xl font-black text-brand-600",children:"404"}),n.jsx("h1",{className:"mt-3 text-xl font-bold text-neutral-900",children:"Page not found"}),n.jsx("p",{className:"mt-1 text-sm text-neutral-500",children:"The page you're looking for doesn't exist."}),n.jsx(E,{asChild:!0,className:"mt-6",children:n.jsx(ot,{to:"/",children:"Back to dashboard"})})]})}function _d(){return n.jsxs(Vs,{children:[n.jsx(ne,{path:"/login",element:n.jsx(ac,{})}),n.jsx(ne,{path:"/register",element:n.jsx(oc,{})}),n.jsx(ne,{element:n.jsx(ia,{}),children:n.jsx(ne,{element:n.jsx(Fa,{}),children:n.jsxs(ne,{element:n.jsx(rc,{}),children:[n.jsx(ne,{index:!0,element:n.jsx(Xc,{})}),n.jsx(ne,{path:"requests",element:n.jsx(nd,{})}),n.jsx(ne,{path:"earnings",element:n.jsx(ad,{})}),n.jsx(ne,{path:"wallet",element:n.jsx(pd,{})}),n.jsx(ne,{path:"profile",element:n.jsx(xd,{})}),n.jsx(ne,{path:"*",element:n.jsx(jd,{})})]})})})]})}window.addEventListener("auth:unauthorized",()=>{R.getState().logout()});R.getState().initialize();const Nd=document.getElementById("root");yr(Nd).render(n.jsx(p.StrictMode,{children:n.jsx(Fs,{client:_r,children:n.jsxs(Hs,{children:[n.jsx(_d,{}),n.jsx(Oa,{})]})})}));
