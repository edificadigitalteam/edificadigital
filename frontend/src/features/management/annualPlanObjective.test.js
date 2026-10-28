import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeAnnualObjective, annualObjectiveFields, requiresResponsibleAssignment } from './annualPlanObjective.js'

const page=readFileSync(new URL('./ManagementAnnualPlanPage.jsx',import.meta.url),'utf8')
const css=readFileSync(new URL('./management-annual-plan.css',import.meta.url),'utf8')

test('editing objective with null description never passes null into textarea',()=>{
 const normalized=normalizeAnnualObjective({id:'a',code:'GEN-OBJ-1',title:'Lograr objetivos',description:null,weight:null,objective_level:null,status:null})
 assert.equal(normalized.description,'')
 assert.equal(normalized.title,'Lograr objetivos')
 assert.equal(normalized.weight,'')
 assert.equal(normalized.objective_level,'specific')
 assert.equal(normalized.status,'active')
})
test('nullable and undefined objective fields are normalized and cleaned',()=>{
 assert.equal(normalizeAnnualObjective(null).description,'')
 assert.equal(normalizeAnnualObjective({title:undefined,description:undefined}).title,'')
 assert.deepEqual(annualObjectiveFields({title:'  Visitar iglesias ',description:null,weight:'',objective_level:'specific',status:'active'}),{title:'Visitar iglesias',description:null,weight:null,objective_level:'specific',status:'active'})
 assert.equal(annualObjectiveFields({title:'A',description:'  Apoyar ',weight:0,objective_level:'general',status:'active'}).description,'Apoyar')
 assert.equal(annualObjectiveFields({title:'A',description:null,weight:0,objective_level:'general',status:'active'}).weight,0)
})
test('saving an objective does not erase existing unit assignments',()=>{
 assert.equal(requiresResponsibleAssignment([{objective_id:'a',unit_id:'u',assignment_type:'responsible'}],'a','u'),false)
 assert.equal(requiresResponsibleAssignment([{objective_id:'a',unit_id:'v',assignment_type:'responsible'}],'a','u'),true)
 assert.equal(requiresResponsibleAssignment([{objective_id:'a',unit_id:'u',assignment_type:'support'}],'a','u'),true)
 assert.doesNotMatch(page,/from\('objective_unit_assignment'\)\.delete\(\)\.eq\('objective_id',data\.id\)/)
 assert.match(page,/requiresResponsibleAssignment\(/)
})
test('annual plan uses typed normalization for edit and save',()=>{
 assert.match(page,/normalizeAnnualObjective\(objective\)/)
 assert.match(page,/annualObjectiveFields\(objectiveForm\)/)
 assert.doesNotMatch(page,/objectiveForm\.description\.trim\(\)/)
})
test('header layout prevents vertically stacked buttons on desktop, tablet and mobile',()=>{
 assert.match(css,/\.annual-plan-page\s+\.management-panel-heading\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)/)
 assert.match(css,/\.annual-plan-page\s+\.management-heading-actions\s*\{[^}]*flex-wrap:\s*wrap/)
 assert.match(css,/\.annual-plan-page\s+\.management-heading-actions\s+(?:button|a)[^\{]*\{[^}]*word-break:\s*normal/)
 assert.match(css,/@media\s*\(max-width:\s*720px\)/)
 assert.match(css,/@media\s*\(max-width:\s*480px\)/)
})
