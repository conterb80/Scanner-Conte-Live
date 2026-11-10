import {readFile,writeFile} from 'node:fs/promises';

const leagues={D1:'ger.1',E0:'eng.1',E1:'eng.2',F1:'fra.1',I1:'ita.1',I2:'ita.2',
 N1:'ned.1',P1:'por.1',SP1:'esp.1',SP2:'esp.2'};
const aliases={
 'augsburg':'fc augsburg','stuttgart':'vfb stuttgart','leeds':'leeds united',
 'tottenham':'tottenham hotspur','newcastle':'newcastle united','nott m forest':'nottingham forest',
 'man city':'manchester city','norwich':'norwich city','portsmouth':'portsmouth',
 'stoke':'stoke city','wolves':'wolverhampton wanderers','birmingham':'birmingham city',
 'swansea':'swansea city','blackburn':'blackburn rovers','west ham':'west ham united',
 'cardiff':'cardiff city','charlton':'charlton athletic','preston':'preston north end',
 'qpr':'queens park rangers','lincoln':'lincoln city','west brom':'west bromwich albion',
 'fc koln':'fc cologne','leverkusen':'bayer leverkusen',
 'freiburg':'sc freiburg','union berlin':'1 fc union berlin',
 'hoffenheim':'tsg hoffenheim','brighton':'brighton hove albion',
 'ipswich':'ipswich town','bournemouth':'afc bournemouth',
 'man united':'manchester united','rennes':'stade rennais',
 'le havre':'le havre ac','monaco':'as monaco',
 'milan':'ac milan','inter':'internazionale',
 'feyenoord':'feyenoord rotterdam','groningen':'fc groningen',
 'betis':'real betis','sociedad':'real sociedad',
 'vallecano':'rayo vallecano','celta':'celta vigo',
 'ath madrid':'atletico madrid',
 'auxerre':'aj auxerre','verona':'hellas verona','avellino':'us avellino',
 'for sittard':'fortuna sittard','santander':'racing santander',
 'espanol':'espanyol','la coruna':'deportivo','ath bilbao':'athletic club'
};
function team(name){
 const key=name.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 return aliases[key]??key;
}
const rome=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'});
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const labPath='data/lab_auto.json';
const lab=await read(labPath), feed=await read('data/results_public.json');
if(lab.schema!=='scanner-conte-lab-v1'||feed.schema!=='scanner-conte-results-public-v1')throw Error('Schema risultati LAB non valido');
const now=new Date();
let closed=0;
for(const record of lab.records){
 const league=leagues[record.league?.split(' · ')[0]];
 const kickoff=Date.parse(record.kickoff);
 if(record.status!=='pending'||!record.fixture_id?.startsWith('fd-')||!league||
    !Number.isFinite(kickoff)||kickoff>now.getTime()-115*60000)continue;
 const [home,away,...extra]=record.match.split(' - ');
 if(!home||!away||extra.length)continue;
 const matches=feed.fixtures.filter(result=>result.league_code===league&&result.status==='FT'&&
   Number.isInteger(result.home_goals)&&Number.isInteger(result.away_goals)&&
   Math.abs(Date.parse(result.kickoff)-kickoff)<=60*60000&&
   rome.format(new Date(result.kickoff))===rome.format(new Date(kickoff))&&
   team(result.home)===team(home)&&team(result.away)===team(away));
 if(matches.length!==1)continue;
 const [result]=matches;
 const h=result.home_goals,a=result.away_goals;
 let won;
 if(record.strategy==='OVER25_CONTROLLO'&&record.selection==='Over 2.5')won=h+a>=3;
 if(record.strategy==='FAVORITA_1X2_CONTROLLO'&&record.selection==='Home')won=h>a;
 if(record.strategy==='FAVORITA_1X2_CONTROLLO'&&record.selection==='Away')won=a>h;
 if(won===undefined||!Number.isFinite(record.odds)||!Number.isFinite(record.stake_virtual))continue;
 record.status=won?'won':'lost';
 record.pnl=Math.round(100*record.stake_virtual*(won?record.odds-1:-1))/100;
 record.score=h+'-'+a;
 record.settled_at=now.toISOString();
 record.settlement_source=result.source;
 record.settlement_reference=result.source_url;
 closed++;
}
if(closed){
 lab.stats={total:lab.records.length,pending:lab.records.filter(r=>r.status==='pending').length,
  won:lab.records.filter(r=>r.status==='won').length,lost:lab.records.filter(r=>r.status==='lost').length,
  pnl:Math.round(100*lab.records.reduce((sum,r)=>sum+(Number.isFinite(r.pnl)?r.pnl:0),0))/100};
 lab.last_open_result_check=now.toISOString();
 await writeFile(labPath,JSON.stringify(lab,null,2)+'\n');
}
console.log('LAB automatico: '+closed+' test chiusi con risultati FT pubblici.');
