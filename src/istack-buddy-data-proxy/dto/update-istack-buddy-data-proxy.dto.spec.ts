import { UpdateIstackBuddyDataProxyDto } from './update-istack-buddy-data-proxy.dto';
import { CreateIstackBuddyDataProxyDto } from './create-istack-buddy-data-proxy.dto';

describe('UpdateIstackBuddyDataProxyDto', () => {
  it('should be defined', () => {
    expect(UpdateIstackBuddyDataProxyDto).toBeDefined();
  });

  it('should be instantiable', () => {
    const dto = new UpdateIstackBuddyDataProxyDto();
    expect(dto).toBeDefined();
    expect(dto).toBeInstanceOf(UpdateIstackBuddyDataProxyDto);
  });

  it('should be based on CreateIstackBuddyDataProxyDto through PartialType', () => {
    const updateDto = new UpdateIstackBuddyDataProxyDto();
    const createDto = new CreateIstackBuddyDataProxyDto();

    // Both should have similar structure since PartialType creates partial version
    expect(Object.keys(updateDto)).toEqual(Object.keys(createDto));
  });

  it('should create empty DTO by default', () => {
    const dto = new UpdateIstackBuddyDataProxyDto();
    const keys = Object.keys(dto);
    expect(keys).toHaveLength(0);
  });

  it('should be extensible for future properties', () => {
    const dto = new UpdateIstackBuddyDataProxyDto();
    (dto as any).testProperty = 'test value';
    expect((dto as any).testProperty).toBe('test value');
  });

  it('should work with spread operator', () => {
    const dto = new UpdateIstackBuddyDataProxyDto();
    const spread = { ...dto };
    expect(spread).toEqual({});
  });

  it('should be serializable to JSON', () => {
    const dto = new UpdateIstackBuddyDataProxyDto();
    const json = JSON.stringify(dto);
    expect(json).toBe('{}');
  });

  it('should work with multiple instances', () => {
    const dto1 = new UpdateIstackBuddyDataProxyDto();
    const dto2 = new UpdateIstackBuddyDataProxyDto();
    expect(dto1).not.toBe(dto2);
    expect(dto1).toEqual(dto2);
  });

  it('should be compatible with its own type', () => {
    const updateDto = new UpdateIstackBuddyDataProxyDto();
    const dto: UpdateIstackBuddyDataProxyDto = updateDto;
    expect(dto).toBe(updateDto);
  });

  it('should inherit behavior from PartialType', () => {
    const updateDto = new UpdateIstackBuddyDataProxyDto();
    const createDto = new CreateIstackBuddyDataProxyDto();
    expect(Object.keys(updateDto)).toEqual(Object.keys(createDto));
  });
});
