export class RoomError extends Error {
 constructor(public code: string, public httpStatus: number, message = code, public details?: Record<string, unknown>) { super(message); }
}
export function fail(code: string, status = 409, message = code, details?: Record<string, unknown>): never { throw new RoomError(code,status,message,details); }
