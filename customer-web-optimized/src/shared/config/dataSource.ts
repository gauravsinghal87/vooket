export type DataSource = 'api' | 'mock';

export function getDataSource(): DataSource {
  const ds = import.meta.env.VITE_DATA_SOURCE;
  return ds === 'api' ? 'api' : 'mock';
}

export const IS_API = getDataSource() === 'api';
export const IS_MOCK = getDataSource() === 'mock';
