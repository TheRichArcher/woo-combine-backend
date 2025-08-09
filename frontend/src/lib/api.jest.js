export default {
  get: async () => ({ status: 200, data: {} }),
  post: async () => ({ status: 200, data: {} }),
  interceptors: { request: { use: () => {} }, response: { use: () => {} } },
};

export const apiHealth = () => Promise.resolve({ status: 200, data: {} });
export const apiWarmup = () => Promise.resolve({ status: 200, data: {} });


