import assert from "node:assert/strict";
import { test } from "node:test";
import { signRequest } from "./s3.mjs";

// Published AWS SigV4 example (S3 "GET Object" with Range): the signature below comes from the AWS docs.
test("SigV4 matches the AWS documentation test vector", () => {
  const h = signRequest({
    method: "GET",
    url: "https://examplebucket.s3.amazonaws.com/test.txt",
    headers: { Range: "bytes=0-9" },
    payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    date: new Date("2013-05-24T00:00:00Z"),
  });
  assert.match(
    h.Authorization,
    /Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/,
  );
  assert.match(h.Authorization, /SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,/);
});

test("SigV4 matches the AWS test vector with a query string (list objects)", () => {
  const h = signRequest({
    method: "GET",
    url: "https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J",
    payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    date: new Date("2013-05-24T00:00:00Z"),
  });
  assert.match(
    h.Authorization,
    /Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7$/,
  );
});
