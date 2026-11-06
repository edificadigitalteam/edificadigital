import { calendarYearTitle } from './annualHeader.js'
import { presentationDayRange, presentationYearSections, presentationReviewState } from './presentation.js'
import { isAssociationNotice } from './associationNotices.js'

const MONTHS={
 es:['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
 en:['January','February','March','April','May','June','July','August','September','October','November','December'],
}
const COLORS={
 pending:{background:'#EFF5FA',foreground:'#305775'},
 validated:{background:'#E9F5EF',foreground:'#21613F'},
 observed:{background:'#FBECEC',foreground:'#95373C'},
 informational:{background:'#EAF3FA',foreground:'#245B7B'},
}
const string=(v)=>String(v??'').trim()
const value=(v)=>string(v)||'—'

export function buildCalendarPdfDefinition({
 organizationName,period,header={},activities=[],units=[],language='es',scopeLabel='',generatedAt=new Date(),
}={}){
 const lang=language==='en'?'en':'es'
 const year=Number(String(period?.start_date||'').slice(0,4))||null
 const labels=lang==='es'?{
  plan:'Plan quinquenal',pillar:'Pilar anual',bible:'Texto Bíblico',date:'FECHA',
  activity:'ACTIVIDAD',responsibles:'RESPONSABLES',empty:'Sin actividades registradas.',
  review:'Revisión',generated:'Respaldo generado',page:'Página',institution:'CALENDARIO INSTITUCIONAL',
  scope:'Vista',person:'Responsable',
 }:{
  plan:'Five-year plan',pillar:'Annual pillar',bible:'Bible verse',date:'DATE',
  activity:'ACTIVITY',responsibles:'RESPONSIBLE',empty:'No activities recorded.',
  review:'Review',generated:'Backup generated',page:'Page',institution:'INSTITUTIONAL CALENDAR',
  scope:'View',person:'Owner',
 }
 const byUnit=new Map(units.map(u=>[u.id,u]))
 const date=generatedAt instanceof Date&&!Number.isNaN(generatedAt.getTime())
    ?generatedAt.toLocaleString(lang==='es'?'es-VE':'en-US',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC'
    :''
 const content=[
  {text:value(organizationName)||labels.institution,style:'institution'},
  {text:calendarYearTitle(header,period,lang),style:'documentTitle'},
  {text:[{text:labels.plan+': ',bold:true},value(header?.five_year_plan)],style:'metaLine'},
  {text:[{text:labels.pillar+': ',bold:true},value(header?.annual_pillar)],style:'metaLine'},
  {text:[{text:labels.bible+': ',bold:true},value(header?.bible_text)],style:'metaLine'},
  {text:`${labels.scope}: ${value(scopeLabel)}    ·    ${labels.generated}: ${date}`,style:'scopeLine'},
 ]
 for(const {index,activities:monthActivities} of presentationYearSections(activities,year)){
  const tableBody=[[
   {text:labels.date,style:'tableHead'},
   {text:labels.activity,style:'tableHead'},
   {text:labels.responsibles,style:'tableHead'},
  ]]
  for(const activity of monthActivities){
   const state=presentationReviewState(activity.review_status,lang)
   const colors=COLORS[state.tone]||COLORS.pending
   const unit=byUnit.get(activity.unit_id)
   const responsible=isAssociationNotice(activity)
     ?value(activity.association_name||activity.responsible_name)
     :[unit?.code,activity.responsible_name].map(string).filter(Boolean).join(' · ')||'—'
   const description=string(activity.description)
   tableBody.push([
     {text:presentationDayRange(activity.start_date,activity.end_date,lang),style:'dateCell',fillColor:colors.background},
     {stack:[
       {text:value(activity.title),bold:true,fontSize:10.8,color:'#192D40'},
       ...(description?[{text:description,fontSize:8.4,color:'#566579',margin:[0,2,0,0]}]:[]),
       {text:labels.review+': '+state.label,fontSize:8.3,color:colors.foreground,margin:[0,3,0,0],bold:true},
     ],fillColor:colors.background},
     {text:responsible,fontSize:10,bold:true,color:'#263C54',fillColor:colors.background},
   ])
  }
  if(!monthActivities.length)tableBody.push([{text:labels.empty,colSpan:3,color:'#738397',italics:true,margin:[4,5,0,5]}, {}, {}])
  content.push({text:`${MONTHS[lang][index].toUpperCase()} · ${monthActivities.length}`,style:'monthSection',margin:[0,15,0,0],pageBreak:index===0?undefined:undefined})
  content.push({
   table:{headerRows:1,keepWithHeaderRows:1,widths:['15%','60%','25%'],dontBreakRows:true,body:tableBody},
   layout:{
    hLineWidth:()=>.5,vLineWidth:()=>.5,
    hLineColor:()=>'#B8C9D6',vLineColor:()=>'#B8C9D6',
    paddingLeft:()=>7,paddingRight:()=>7,paddingTop:()=>7,paddingBottom:()=>7,
   },
  })
 }
 return {
  pageSize:'A4',pageOrientation:'landscape',pageMargins:[30,32,30,36],
  content,
  styles:{
   institution:{fontSize:11,bold:true,color:'#173957',margin:[0,0,0,4]},
   documentTitle:{fontSize:21,bold:true,color:'#173957',margin:[0,0,0,13]},
   metaLine:{fontSize:10.5,color:'#2D3D4E',margin:[0,2,0,2]},
   scopeLine:{fontSize:8.7,color:'#5D6F80',margin:[0,10,0,4]},
   monthSection:{fontSize:13,bold:true,color:'#FFF',background:'#173957',margin:[0,0,0,0]},
   tableHead:{fontSize:10.5,bold:true,color:'#FFF',fillColor:'#173957',margin:[0,2,0,2]},
   dateCell:{fontSize:10.5,bold:true,color:'#173957',alignment:'center'},
  },
  defaultStyle:{font:'Roboto',fontSize:10,color:'#213547'},
  footer:(page,pages)=>({
   text:`${value(organizationName)} · ${year||''}     ${labels.page} ${page}/${pages}`,
   fontSize:8.5,color:'#647589',alignment:'center',margin:[0,10,0,0],
  }),
 }
}
