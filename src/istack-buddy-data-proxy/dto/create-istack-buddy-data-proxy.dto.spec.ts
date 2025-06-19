import { CreateIstackBuddyDataProxyDto } from './create-istack-buddy-data-proxy.dto';

describe('CreateIstackBuddyDataProxyDto', () => {
  it('should be defined', () => {
    expect(CreateIstackBuddyDataProxyDto).toBeDefined();
  });

  it('should be instantiable', () => {
    const dto = new CreateIstackBuddyDataProxyDto();
    expect(dto).toBeDefined();
    expect(dto).toBeInstanceOf(CreateIstackBuddyDataProxyDto);
  });

  it('should create empty DTO by default', () => {
    const dto = new CreateIstackBuddyDataProxyDto();
    const keys = Object.keys(dto);
    expect(keys).toHaveLength(0);
  });

  it('should be extensible for future properties', () => {
    const dto = new CreateIstackBuddyDataProxyDto();
    (dto as any).testProperty = 'test value';
    expect((dto as any).testProperty).toBe('test value');
  });

  it('should work with spread operator', () => {
    const dto = new CreateIstackBuddyDataProxyDto();
    const spread = { ...dto };
    expect(spread).toEqual({});
  });

  it('should be serializable to JSON', () => {
    const dto = new CreateIstackBuddyDataProxyDto();
    const json = JSON.stringify(dto);
    expect(json).toBe('{}');
  });

  it('should work with multiple instances', () => {
    const dto1 = new CreateIstackBuddyDataProxyDto();
    const dto2 = new CreateIstackBuddyDataProxyDto();
    expect(dto1).not.toBe(dto2);
    expect(dto1).toEqual(dto2);
  });

  it('should be compatible with type checking', () => {
    const dto: CreateIstackBuddyDataProxyDto =
      new CreateIstackBuddyDataProxyDto();
    expect(dto).toBeInstanceOf(CreateIstackBuddyDataProxyDto);
  });
});
