import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duration, sampleJourney, TOTAL_DURATION, transition, type Phase } from './journey.ts';
test('the journey requires entering and selecting 13, and replays cleanly', () => {
  let phase: Phase = 'arrival';
  for (const [event, expected] of [['ENTER','entering'],['COMPLETE','boarding'],['SELECT_13','riding'],['COMPLETE','revealing'],['COMPLETE','reveal'],['REPLAY','arrival']] as const) {
    phase=transition(phase,event); assert.equal(phase,expected);
  }
  assert.equal(transition('arrival','SELECT_13'),'arrival');
  assert.equal(transition('boarding','COMPLETE'),'boarding');
  assert.equal(transition('riding','SELECT_13'),'riding');
  assert.equal(transition('entering','REPLAY'),'entering');
});
test('automatic sequence lasts 18.2 seconds and waiting phases have no timer',()=>{
  assert.equal(TOTAL_DURATION,18200);
  for(const phase of ['arrival','boarding','reveal'] as const)assert.equal(duration(phase),0);
  assert.ok(duration('entering',true)<duration('entering'));
});
test('doors close before the outside world changes and camera exits after reopening',()=>{
  const frame=(phase:Phase,progress:number)=>sampleJourney({phase,progress,reduced:false});
  assert.equal(frame('arrival',0).doors,0);
  assert.equal(frame('boarding',0).doors,1);
  assert.equal(frame('riding',.2).doors,0);
  assert.equal(frame('riding',.2).city,false);
  assert.equal(frame('riding',.5).city,true);
  assert.equal(frame('revealing',0).doors,0);
  assert.equal(frame('revealing',.2).exit,0);
  assert.equal(frame('reveal',1).exit,1);
  assert.equal(frame('reveal',1).floor,13);
});
test('reduced motion removes camera drift and uses a masked cut',()=>{
  const before=sampleJourney({phase:'entering',progress:.49,reduced:true});
  const after=sampleJourney({phase:'entering',progress:.51,reduced:true});
  assert.equal(before.entry,0); assert.equal(after.entry,1);
  assert.ok(before.fade>.9); assert.equal(after.shake,0);
});
