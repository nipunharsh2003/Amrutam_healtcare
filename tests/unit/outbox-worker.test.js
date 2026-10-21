const { deliverEvent } = require('../../src/workers/outboxWorker');

const event = {
  id: 'd4fe3f4d-d363-4f72-97a6-d53f170a1bdd',
  eventType: 'CONSULTATION_BOOKED',
  aggregateType: 'CONSULTATION',
  aggregateId: '0a7c3b3a-02a9-43d8-9a70-89d8d9d8df00',
  payload: { consultationId: '0a7c3b3a-02a9-43d8-9a70-89d8d9d8df00', patientId: 'patient-id' },
  createdAt: new Date('2030-01-01T00:00:00.000Z'),
};

describe('outbox webhook delivery', () => {
  test('sends authenticated, idempotent event with no clinical details', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 202 });
    const result = await deliverEvent(event, { url: 'https://events.example.test/hook', token: 'a'.repeat(32) }, fetchImpl);
    const [url, options] = fetchImpl.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(result).toMatchObject({ delivered: true, retryable: false });
    expect(url).toBe('https://events.example.test/hook');
    expect(options.headers['idempotency-key']).toBe(event.id);
    expect(options.headers.authorization).toBe(`Bearer ${'a'.repeat(32)}`);
    expect(body.payload).not.toHaveProperty('prescription');
    expect(body.payload).not.toHaveProperty('details');
  });

  test('retries server failures but not permanent client errors', async () => {
    const retryable = await deliverEvent(event, { url: 'https://events.example.test/hook', token: 'a'.repeat(32) }, async () => ({ ok: false, status: 503 }));
    const permanent = await deliverEvent(event, { url: 'https://events.example.test/hook', token: 'a'.repeat(32) }, async () => ({ ok: false, status: 401 }));

    expect(retryable).toMatchObject({ delivered: false, retryable: true, errorCode: 'HTTP_503' });
    expect(permanent).toMatchObject({ delivered: false, retryable: false, errorCode: 'HTTP_401' });
  });

  test('classifies network errors for retry without exposing error text', async () => {
    const result = await deliverEvent(event, { url: 'https://events.example.test/hook', token: 'a'.repeat(32) }, async () => {
      throw new Error('sensitive transport detail');
    });

    expect(result).toEqual({ delivered: false, retryable: true, errorCode: 'TRANSPORT_ERROR' });
  });
});