import test from 'node:test'
import assert from 'node:assert/strict'
import { presentationMonthActivities, validatePresentationEdit, nextPresentationMonth } from './presentation.js'

test('the presentation shows one month at a time with chronological activities', () => {
  const activities = [
    { id:'d', start_date:'2027-03-10', title:'Ten' },
    { id:'b', start_date:'2027-02-28', title:'Other month' },
    { id:'a', start_date:'2027-03-02', title:'Two' },
    { id:'c', start_date:'2027-03-02', title:'Same day' },
  ]
  assert.deepEqual(presentationMonthActivities(activities, 2).map(x=>x.id), ['c','a','d'])
  assert.deepEqual(presentationMonthActivities(activities, 0), [])
  assert.deepEqual(presentationMonthActivities(activities, 12), [])
})

test('month navigation stays inside the selected management year', () => {
  assert.equal(nextPresentationMonth(0,-1),0)
  assert.equal(nextPresentationMonth(4,-1),3)
  assert.equal(nextPresentationMonth(5,1),6)
  assert.equal(nextPresentationMonth(11,1),11)
})

test('live meeting edits require a title and valid dates within the management period', () => {
  const period = {start_date:'2027-01-01',end_date:'2027-12-31'}
  assert.equal(validatePresentationEdit({title:' Reunión ',start_date:'2027-02-14',end_date:'2027-02-15'},period),'')
  assert.equal(validatePresentationEdit({title:'',start_date:'2027-02-14'},period),'missing')
  assert.equal(validatePresentationEdit({title:'Actividad',start_date:''},period),'missing')
  assert.equal(validatePresentationEdit({title:'Actividad',start_date:'2027-02-15',end_date:'2027-02-01'},period),'dates')
  assert.equal(validatePresentationEdit({title:'Actividad',start_date:'2026-12-31'},period),'dates')
  assert.equal(validatePresentationEdit({title:'Actividad',start_date:'2028-01-01'},period),'dates')
  assert.equal(validatePresentationEdit({title:'Actividad',start_date:'2027-02-01',end_date:'2028-01-01'},period),'dates')
  assert.equal(validatePresentationEdit({title:'Actividad',start_date:'2027-02-01'},period),'')
})

test('the presentation keeps records from other years out of each month', () => {
  const activities=[{id:'26',start_date:'2026-04-12'}, {id:'27',start_date:'2027-04-12'}]
  assert.deepEqual(presentationMonthActivities(activities,3,2027).map(x=>x.id),['27'])
})
