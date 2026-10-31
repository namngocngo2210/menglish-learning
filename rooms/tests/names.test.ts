import { describe, expect, it } from 'vitest';
import { validateName } from '../src/names';

const names = ['Anh','Bình','Dũng','Linh','Phúc','Hùng','Khánh','Long','Lan','Lộc','Dương','Hải','Hạnh','Hiếu','Huy','Mai','Minh','Ngọc','Nam','Nga','Ngư','Phong','Quân','Quỳnh','Sơn','Thảo','Thu','Trang','Trung','Tú','Uyên','Việt','Vy','Yến','Đức','Đạt','Du','Duy','Cúc','Tuấn Anh','Minh Long','Gia Bảo','Bảo Ngọc','Alexandra','Edith','Essex','Salon'];
const bad = ['fuck','F u c k','xxFUCKxx','sh1t','Sh!t'.replace('!','i'),'Địt','dit','đ.ị.t','Lồn','l0n','V.C.L','đụ má','Du Ma','Cặc','buồi','Con Chó','thằng ngu','Ngu Ngốc','Admin','Giáo Viên','BeeJunior','nigger','Hitler','porn','0912345678x','zalo123','my.fb','http','12','🙂🙂'];

describe('name filter', () => {
  it.each(names)('accepts %s', n => { expect(validateName(n)).toBe(n); });
  it.each(bad)('rejects %s', n => { expect(() => validateName(n)).toThrow(expect.objectContaining({ code: 'name_rejected' })); });
});
