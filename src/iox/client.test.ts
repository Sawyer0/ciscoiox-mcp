import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IoxClient } from './client';
import axios from 'axios';

describe('IoxClient', () => {
  it('should be instantiable with config', () => {
    const client = new IoxClient('https://1.2.3.4:8443', 'admin', 'pass');
    expect(client).toBeInstanceOf(IoxClient);
  });

  it('should configure axios with basic auth', () => {
    const client = new IoxClient('https://1.2.3.4:8443', 'admin', 'pass');
    // @ts-ignore - Accessing private property for testing
    expect(client.client.defaults.auth).toEqual({
      username: 'admin',
      password: 'pass',
    });
    // @ts-ignore
    expect(client.client.defaults.baseURL).toBe('https://1.2.3.4:8443/api/v1');
  });
});
