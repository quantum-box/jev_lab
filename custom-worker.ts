import handler from 'vinext/server/fetch-handler';

export { JevLiveLedger } from './lib/live-ledger-do';

const worker = {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
};

export default worker;

interface Env {
  ASSETS: Fetcher;
  JEV_LIVE_LEDGER: DurableObjectNamespace;
}
