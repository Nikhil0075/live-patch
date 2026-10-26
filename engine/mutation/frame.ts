const workerBootstrap = `
let port;
let mutation;
self.onmessage = event => {
  if (port || event.data?.type !== 'init' || !event.ports?.[0]) return;
  port = event.ports[0];
  port.onmessage = async ({ data }) => {
    try {
      if (data.type === 'load') {
        const url = URL.createObjectURL(new Blob([data.source], { type: 'text/javascript' }));
        try { mutation = await import(url); } finally { URL.revokeObjectURL(url); }
        const meta = mutation.meta;
        if (!meta || !['id','title','author','description'].every(key => typeof meta[key] === 'string' && meta[key].length > 0 && meta[key].length < 120)) throw Error('Invalid mutation metadata');
        port.postMessage({ type: 'ready', meta });
      } else if (data.type === 'event') {
        const actions = [];
        const game = Object.create(null);
        game.state = Object.freeze(data.state);
        for (const name of data.actions) game[name] = (...args) => { actions.push({ type: name, args }); };
        Object.freeze(game);
        const hook = data.hooks[data.event.type];
        if (hook && typeof mutation?.[hook] === 'function') await mutation[hook](game, data.event);
        port.postMessage({ type: 'reply', id: data.id, actions });
      }
    } catch (error) { port.postMessage({ type: 'error', id: data.id, error: String(error) }); }
  };
  port.start();
};
self.addEventListener('error', event => { port?.postMessage({ type: 'error', error: String(event.message) }); });
self.addEventListener('unhandledrejection', event => { port?.postMessage({ type: 'error', error: String(event.reason) }); });
`;

// The module executes in a Worker, so it cannot access frame navigation or sibling frames.
// The opaque frame's CSP is inherited by its blob Worker and blocks network connections.
export const frameDocument = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src 'none'; form-action 'none'; base-uri 'none'"><script>
const workerCode = ${JSON.stringify(workerBootstrap)};
let loaded = false;
let worker;
let channel;
addEventListener('message', event => {
  if (event.source !== parent || !event.data || typeof event.data.type !== 'string') return;
  const data = event.data;
  if (data.type === 'load' && !loaded) {
    loaded = true;
    const url = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }));
    worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onerror = error => parent.postMessage({ type: 'error', error: String(error.message) }, '*');
    channel = new MessageChannel();
    channel.port1.onmessage = message => parent.postMessage(message.data, '*');
    worker.postMessage({ type: 'init' }, [channel.port2]);
    channel.port1.postMessage({ type: 'load', source: data.source });
  } else if (data.type === 'event' && loaded) channel?.port1.postMessage(data);
  else if (data.type === 'dispose') { worker?.terminate(); channel?.port1.close(); }
});
<\/script>`;
