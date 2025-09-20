
import type { Provider } from '../../types';
import { qiitaProvider } from './qiita';

export const allProviders: Provider[] = [qiitaProvider];

export const providerRegistry: { [key: string]: Provider } = {
  qiita: qiitaProvider,
};