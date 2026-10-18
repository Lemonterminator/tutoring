import { useRef, useState } from 'preact/hooks';
import { martingaleCards } from './martingale-game-compute';
import './dot-product-game.css';

export function MartingaleGame({lang='zh'}: {lang?:'en'|'zh'}) {
  const zh=lang==='zh', tr=(a:string,b:string)=>zh?a:b;
  const fresh=()=>crypto.getRandomValues(new Uint32Array(1))[0];
  const [seed,setSeed]=useState(fresh), [step,setStep]=useState(0);
  const [answers,setAnswers]=useState<string[]>([]), [slots,setSlots]=useState(['','']);
  const [selected,setSelected]=useState(''), [passed,setPassed]=useState(false);
  const [feedback,setFeedback]=useState(''), [hint,setHint]=useState(false);
  const [retries,setRetries]=useState(0), [hints,setHints]=useState(0);
  const heading=useRef<HTMLHeadingElement>(null);
  const cards=martingaleCards(seed,lang), done=step===cards.length, card=cards[Math.min(step,cards.length-1)];
  const clear=()=>{setAnswers([]);setSlots(['','']);setSelected('');setPassed(false);setFeedback('');setHint(false);};
  const restart=()=>{let next=fresh();while(JSON.stringify(martingaleCards(next,lang))===JSON.stringify(cards))next=fresh();setSeed(next);setStep(0);setRetries(0);setHints(0);clear();};
  const place=(index:number,value:string)=>{if(!passed&&['ℱₙ','ℱₙ₊₁','Mₙ','Mₙ₊₁'].includes(value)) {setSlots(old=>old.map((item,i)=>i===index?value:item));setFeedback('');}};
  const check=()=>{
    const filled=card.formula?slots.every(Boolean):card.choices?answers[0]!==undefined:card.fields!.every((_,i)=>/^[-+]?\d+$/.test((answers[i]??'').trim()));
    if(!filled){setFeedback(tr('先填完空格或选一个答案。','Fill all blanks or select an answer.'));return;}
    const correct=card.formula?slots[0]==='ℱₙ'&&slots[1]==='Mₙ':card.choices?Number(answers[0])===card.correct:card.fields!.every((field,i)=>Number(answers[i])===field.answer);
    if(correct){setPassed(true);setFeedback(tr('对了。下面是这一步的理由。','Correct. The reasoning is below.'));}
    else{setRetries(v=>v+1);setFeedback(tr('还不对。检查当前已知信息、允许的分支和权重；可打开提示再试。','Not yet. Check available information, possible branches and weights; use a hint if needed.'));}
  };
  return <section class="dot-game" aria-label={tr('鞅挑战','Martingale challenge')}>
    <div class="dot-game__top"><span>{tr('12 关 · 概念更难，算术仍可心算 · 无计时','12 stages · harder concepts, mental arithmetic · no timer')}</span><button class="btn btn--ghost" onClick={restart}>{tr('换一局','New round')}</button></div>
    <progress max={cards.length} value={step} aria-label={tr('完成进度','Progress')} />
    <h3 ref={heading} tabIndex={-1}>{done?tr('挑战完成','Challenge complete'):`${step+1}/${cards.length} · ${card.title}`}</h3>
    {done?<><p>{tr(`完成 ${cards.length} 关，返修 ${retries} 次，提示 ${hints} 次。`,`Completed ${cards.length} stages; ${retries} retries, ${hints} hints.`)}</p><p>{tr('下一次试着不用提示，并解释：为什么均值不变不能推出鞅？哪些信息可以决定赌注？无限停止为什么需要额外条件？这份记录还不能证明掌握了定理。','Next time avoid hints and explain: why is constant mean insufficient? Which information may determine stakes? Why does unbounded stopping require extra conditions? This record does not establish theorem mastery.')}</p><button class="btn" onClick={restart}>{tr('再来一局新数字','Play with new numbers')}</button></>:<>
      <p>{card.prompt}</p>
      {card.lines&&<ul class="martingale-game__branches">{card.lines.map(line=><li>{line}</li>)}</ul>}
      {card.formula&&<><p>{tr('拖拽填槽，或先点击符号再点击空位。','Drag into blanks, or select a symbol and then a blank.')}</p><div class="dot-game__tokens">{['Mₙ₊₁','ℱₙ','Mₙ','ℱₙ₊₁'].map(token=><button type="button" draggable={!passed} disabled={passed} aria-pressed={selected===token} onClick={()=>setSelected(token)} onDragStart={e=>e.dataTransfer?.setData('text/plain',token)}>{token}</button>)}</div><div class="dot-game__formula">E[Mₙ₊₁ | <button class="dot-game__slot" disabled={passed} aria-label={tr('信息空位','Information blank')} onClick={()=>place(0,selected)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();place(0,e.dataTransfer?.getData('text/plain')??'');}}>{slots[0]||'?'}</button>] = <button class="dot-game__slot" disabled={passed} aria-label={tr('当前值空位','Current value blank')} onClick={()=>place(1,selected)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();place(1,e.dataTransfer?.getData('text/plain')??'');}}>{slots[1]||'?'}</button></div></>}
      {card.fields?.map((field,i)=><label class="dot-game__number">{field.label}<input type="text" aria-label={field.label} autoComplete="off" disabled={passed} value={answers[i]??''} onInput={e=>{const value=e.currentTarget.value;setAnswers(old=>{const next=[...old];next[i]=value;return next;});setFeedback('');}} /></label>)}
      {card.choices&&<div class="dot-game__tokens">{card.choices.map((choice,i)=><button class="martingale-game__choice" type="button" disabled={passed} aria-pressed={answers[0]===String(i)} onClick={()=>{setAnswers([String(i)]);setFeedback('');}}>{choice}</button>)}</div>}
      <div class="dot-game__actions">{passed?<button class="btn" onClick={()=>{setStep(step+1);clear();requestAnimationFrame(()=>heading.current?.focus());}}>{step===cards.length-1?tr('查看记录','View record'):tr('下一步','Continue')}</button>:<button class="btn" onClick={check}>{tr('检查','Check')}</button>}<button class="btn btn--ghost" disabled={hint||passed} onClick={()=>{setHint(true);setHints(v=>v+1);}}>{tr('一点提示','Hint')}</button></div>
      <p role="status" class="dot-game__feedback">{feedback}</p>
      {hint&&<p class="dot-game__hint">{card.hint}</p>}
      {passed&&<p class="dot-game__hint">{card.explanation}</p>}
    </>}
  </section>;
}
