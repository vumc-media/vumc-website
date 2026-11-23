/* VUMC seasonal hero layer — preserves original hero and slideshow. */
(function(){
'use strict';
const TZ='America/New_York';
function localDate(){const p=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return new Date(Date.UTC(+v.year,+v.month-1,+v.day));}
const day=86400000;
function utc(y,m,d){return new Date(Date.UTC(y,m-1,d));}
function plus(d,n){return new Date(d.getTime()+n*day);}
function easter(y){let a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),date=(h+l-7*m+114)%31+1;return utc(y,month,date);}
function advent(y){const christmas=utc(y,12,25),dow=christmas.getUTCDay();return plus(christmas,-(dow===0?28:21+dow));}
function thanksgiving(y){const d=utc(y,11,1);return plus(d,(4-d.getUTCDay()+7)%7+21);}
function season(now){const y=now.getUTCFullYear(),e=easter(y),a=advent(y),t=thanksgiving(y);
 if(now>=a&&now<utc(y,12,25)){const week=Math.min(4,1+Math.floor((now-a)/day/7));const themes=[['Hope','The promise of Christ brings light into our darkness.'],['Peace','Preparing our hearts for the coming Prince of Peace.'],['Joy','Rejoice! Our Savior is drawing near.'],['Love',"God’s greatest gift is coming into the world."]];return {type:'advent',week,title:themes[week-1][0],text:themes[week-1][1]};}
 if(now>=utc(y,12,25)&&now<utc(y+1,1,6))return {type:'christmas',week:5,title:'Christ Is Born',text:'Celebrating the light and hope of Christmas'};
 if(now>=utc(y,1,1)&&now<utc(y,1,6))return {type:'christmas',week:5,title:'Christ Is Born',text:'Celebrating the light and hope of Christmas'};
 if(now>=plus(t,-4)&&now<plus(t,3))return {type:'thanksgiving',title:'A Season of Thanksgiving',text:'Giving thanks to God for every blessing and every neighbor'};
 if(now>=plus(e,-46)&&now<plus(e,-7))return {type:'lent',title:'The Journey of Lent',text:'A season of prayer, reflection, and renewal'};
 if(now>=plus(e,-7)&&now<e)return {type:'holyweek',title:'Holy Week',text:'Walking with Christ toward the cross'};
 if(now>=e&&now<plus(e,49))return {type:'easter',title:'He Is Risen!',text:'Celebrating the hope and joy of the resurrection'};
 if(now>=plus(e,49)&&now<plus(e,50))return {type:'pentecost',title:'Come, Holy Spirit',text:'Celebrating the gift of the Spirit and the birth of the Church'};
 return null;
}
function wreath(n){const colors=['#6c4998','#6c4998','#d88ba9','#6c4998','#f4e8d5'];return '<div class="vumc-wreath" role="img" aria-label="'+(n===5?'Four Advent candles and the Christ candle lit':n+' of four Advent candles lit')+'"><div class="vumc-evergreen"></div>'+colors.map((color,i)=>'<div class="vumc-candle vumc-candle-'+i+'" style="--candle:'+color+'">'+(n>i?'<span class="vumc-flame"></span>':'')+'</div>').join('')+'</div>';}
function render(){const hero=document.querySelector('main .hero'),panel=hero&&hero.querySelector('.hero-panel');if(!panel)return;
 const active=season(localDate());const old=document.getElementById('vumc-seasonal-feature');if(old)old.remove();hero.removeAttribute('data-vumc-season');hero.removeAttribute('data-vumc-advent-week');
 if(!active)return;
 hero.setAttribute('data-vumc-season',active.type);if(active.type==='advent')hero.setAttribute('data-vumc-advent-week',String(active.week));
 const section=document.createElement('aside');section.id='vumc-seasonal-feature';section.className='vumc-seasonal-feature';section.setAttribute('aria-label','Church season');
 section.innerHTML='<div class="vumc-seasonal-copy"><h2></h2><p></p></div>'+(active.week?wreath(active.week):'<div class="vumc-seasonal-symbol" aria-hidden="true">'+({thanksgiving:'✦',lent:'✝',holyweek:'✝',easter:'✦',pentecost:'✦'}[active.type]||'✦')+'</div>');
 section.querySelector('h2').textContent=active.title;section.querySelector('p').textContent=active.text;
 panel.prepend(section);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
window.VUMCSeasonal={refresh:render,seasonForDate:season};
})();