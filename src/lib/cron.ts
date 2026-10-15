// CRON_SECRET이 비어있을 때 Bearer undefined 로 통과될 수 있으므로 얼리리턴
export const isCronAuthorized = (request: Request) => {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
};
