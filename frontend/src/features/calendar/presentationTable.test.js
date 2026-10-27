import test from 'node:test'
import assert from 'node:assert/strict'
import { presentationYearSections, presentationDayRange, presentationReviewState, validatePresentationEdit } from './presentation.js'

test('year presentation displays all 12 months, including empty ones, without losing activities', () => {
  const rows = [
    { id:'mar',start_date:'2027-03-03',title:'Reunión de comité' },
    { id:'jan2',start_date:'2027-01-24',title:'Segunda actividad' },
    { id:'jan1',start_date:'2027-01-01',title:'Primera actividad' },
    { id:'old',start_date:'2026-01-01',title:'De otra gestión' },
  ]
  const sections = presentationYearSections(rows,2027)
  assert.equal(sections.length,12)
  assert.deepEqual(sections[0].activities.map(row=>row.id),['jan1','jan2'])
  assert.equal(sections[1].activities.length,0)
  assert.deepEqual(sections[2].activities.map(row=>row.id),['mar'])
  assert.equal(sections.flatMap(section=>section.activities).length,3)
})

test('PDF-like date displays day and range with months for crossing boundaries', () => {
  assert.equal(presentationDayRange('2027-01-01',null,'es'),'1')
  assert.equal(presentationDayRange('2027-01-12','2027-01-19','es'),'12–19')
  assert.equal(presentationDayRange('2027-03-29','2027-04-04','es'),'29/3 – 4/4')
  assert.equal(presentationDayRange('2027-05-02','2027-05-02','es'),'2')
  assert.equal(presentationDayRange('2027-12-31','2028-01-01','es'),'31/12 – 1/1')
})

test('review styles always map to an explicit accessible status', () => {
  assert.deepEqual(presentationReviewState('pending','es'),{ tone:'pending',label:'Pendiente de revisión' })
  assert.deepEqual(presentationReviewState('validated','es'),{ tone:'validated',label:'Validada' })
  assert.deepEqual(presentationReviewState('observed','es'),{ tone:'observed',label:'Observada' })
  assert.deepEqual(presentationReviewState(undefined,'es'),{ tone:'pending',label:'Pendiente de revisión' })
  assert.deepEqual(presentationReviewState('observed','en'),{ tone:'observed',label:'Observed' })
})

test('changing responsible person uses existing activity permissions and preserves date validation', () => {
  const period={ start_date:'2027-01-01',end_date:'2027-12-31' }
  const draft={ title:'Culto especial',start_date:'2027-06-24',end_date:'',responsible_name:'Pastor responsable' }
  assert.equal(validatePresentationEdit(draft,period),'')
  assert.equal(validatePresentationEdit({...draft,start_date:'2028-06-24'},period),'dates')
})
