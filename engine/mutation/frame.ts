// This document runs at an opaque origin. CSP prevents network, navigation, workers and remote code.
export const frameDocument = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; connect-src 'none'; form-action 'none'; base-uri 'none'"><script>
let mutation;
const send = (data) => parent.postMessage(data, '*');
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
addEventListener('message', async ({ data }) => {
  try {
    if (data.type === 'load') {
      const url = URL.createObjectURL(new Blob([data.source], { type: 'text/javascript' }));
      try { mutation = await import(url); } finally { URL.revokeObjectURL(url); }
      const m = mutation.meta;
      if (!m || !['id','title','author','description'].every(k => typeof m[k] === 'string' && m[k].length < 120)) throw Error('Invalid mutation metadata');
      send({ type: 'ready', meta: m });
    }
    if (data.type === 'event') {
      const actions = [];
      const game = Object.freeze({
        state: Object.freeze(data.state),
        spawn(kind,x,y) { if (['enemy','coin','bomb'].includes(kind) && finite(x) && finite(y)) actions.push({type:'spawn',kind,x,y}); },
        setParameter(key,value) { if (['enemySpeed','coinValue','playerSpeed','spawnInterval','gravityX','gravityY'].includes(key) && finite(value)) actions.push({type:'setParameter',key,value}); },
        drawShape(x,y,radius,color) { if ([x,y,radius].every(finite) && typeof color === 'string') actions.push({type:'drawShape',x,y,radius,color}); },
        showMessage(text) { if (typeof text === 'string') actions.push({type:'showMessage',text}); }
      });
      const hook = {start:'onStart',tick:'onTick',spawn:'onSpawn',hit:'onHit',collide:'onCollide',score:'onScore'}[data.event.type];
      if (typeof mutation?.[hook] === 'function') mutation[hook](game, data.event);
      send({type:'actions', actions});
    }
  } catch (error) { send({type:'error', error:String(error)}); }
});
<\/script>`;
