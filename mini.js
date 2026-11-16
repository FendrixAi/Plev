var $=function(i){return document.getElementById(i)},st={mode:"idle"},al=0;
var tk="";for(var i=0;i<12;i++){var a=i*30*Math.PI/180,r1=i%3==0?36:40;
tk+='<line x1="'+(50+r1*Math.sin(a)).toFixed(1)+'" y1="'+(50-r1*Math.cos(a)).toFixed(1)+'" x2="'+(50+44*Math.sin(a)).toFixed(1)+'" y2="'+(50-44*Math.cos(a)).toFixed(1)+'" stroke="var(--mute)" stroke-width="'+(i%3==0?3:1.5)+'"/>';}
$("tk").innerHTML=tk;
function fmt(s){s=Math.max(0,s);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}
var CONT='<path d="M2 2.5l5 4.5-5 4.5zM7.5 2.5l5 4.5-5 4.5z" fill="currentColor"/>',lastCont=null;
var PAUSE='<path d="M4 2.5v9M10 2.5v9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',PLAY='<path d="M4 2.5l8 4.5-8 4.5z" fill="currentColor"/>';
var miniCfg={opacity:1,solidOnHover:false},w8t=0;
window.mini.onState(function(s){st=s;});
window.mini.onAlarm(function(){var p=$("pill");p.classList.remove("warn8");p.classList.add("alarm");clearTimeout(al);al=setTimeout(function(){p.classList.remove("alarm");},10000);});
window.mini.onWarn8(function(){var p=$("pill");p.classList.add("warn8");clearTimeout(w8t);w8t=setTimeout(function(){p.classList.remove("warn8");},4000);});
window.mini.onMiniSettings(function(s){miniCfg=s;});
$("pp").onclick=function(){window.mini.cmd(st.mode==="idle"&&st.canContinue?"continue":"toggle");};
$("ex").onclick=function(){window.mini.cmd("expand");};
$("pill").ondblclick=function(){window.mini.cmd("expand");};
$("pill").addEventListener("mouseenter",function(){window.mini.hover(true);});
$("pill").addEventListener("mouseleave",function(){window.mini.hover(false);});
function frame(){
var n=new Date(),sec=n.getSeconds()+n.getMilliseconds()/1000,mn=n.getMinutes()+sec/60,hr=n.getHours()%12+mn/60;
$("s").setAttribute("transform","rotate("+sec*6+" 50 50)");
$("m").setAttribute("transform","rotate("+mn*6+" 50 50)");
$("h").setAttribute("transform","rotate("+hr*30+" 50 50)");
var rem=0,lab="Belum ada tugas aktif",pp=false;
if(st.mode==="run"&&st.open){rem=Math.floor((Date.now()-st.since)/1000);lab="Waktu bebas";pp=true;$("ppi").innerHTML=PAUSE;}
else if(st.mode==="run"){rem=Math.ceil((st.endAt-Date.now())/1000);lab="Sedang berjalan";pp=true;$("ppi").innerHTML=PAUSE;}
else if(st.mode==="pause"){rem=st.left;lab="Dijeda";pp=true;$("ppi").innerHTML=PLAY;}
else if(st.mode==="brk"){rem=Math.ceil((st.endAt-Date.now())/1000);lab="Istirahat";}
else if(st.canContinue){lab="Sesi selesai";pp=true;}
else if(st.done){lab="Selesai";}
var cont=st.mode==="idle"&&!!st.canContinue;
if(cont)$("ppi").innerHTML=CONT;
if(cont!==lastCont){lastCont=cont;$("pp").className=cont?"cont":"";$("pp").title=cont?"Lanjut fokus":"Jeda / lanjut";$("pp").setAttribute("aria-label",cont?"Lanjut fokus":"Jeda atau lanjutkan");}
$("pill").dataset.mode=st.mode||"idle";
$("lab").textContent=lab;$("cd").textContent=((st.open&&(st.mode==="run"||st.mode==="pause"))?"+":"")+fmt(rem);$("nm").textContent=st.name||"";$("pp").hidden=!pp;
var act=st.mode==="run"||st.mode==="pause"||st.mode==="brk";
$("pg").style.width=act&&st.total&&!st.open?(100*(1-rem/st.total))+"%":"0";
requestAnimationFrame(frame);}
frame();window.mini.ready();
