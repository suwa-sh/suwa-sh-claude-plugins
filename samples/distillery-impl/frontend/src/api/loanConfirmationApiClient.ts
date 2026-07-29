// packages/contracts/api-client/apis/DefaultApi.ts(生成物)が構文エラーを含み import 不能なための
// 一時的な迂回実装。詳細・再発防止の提案は docs/impl/latest/19ec0182/issues/ を参照。
//
// packages/contracts/ 配下のファイルは一切編集していない(コーディング規約 rule 1 準拠)。
// DefaultApi.ts が壊れていない runtime.ts(BaseAPI・リクエスト機構)と models/*.ts(FromJSON/ToJSON)を
// 個別ファイルから直接 import し、この UC のフロントエンドが必要とする 2 操作
// (getBook / createLoan)だけを DefaultApi.ts の実装(同ファイル内で確認済み)と同一の
// path・method・header・body 変換で再現する。fetch/axios の直書きはしない(tier-rules.md)。
import * as runtime from "../../../packages/contracts/api-client/runtime";
import {
  type BookResponse,
  BookResponseFromJSON,
} from "../../../packages/contracts/api-client/models/BookResponse";
import {
  type CreateLoanRequest,
  CreateLoanRequestToJSON,
} from "../../../packages/contracts/api-client/models/CreateLoanRequest";
import {
  type LoanResponse,
  LoanResponseFromJSON,
} from "../../../packages/contracts/api-client/models/LoanResponse";

export interface GetBookRequestParams {
  id: string;
}

export interface CreateLoanRequestParams {
  xIdempotencyKey: string;
  createLoanRequest: CreateLoanRequest;
}

export class LoanConfirmationApiClient extends runtime.BaseAPI {
  /** DefaultApi.ts#getBook と同一のリクエスト内容(GET /api/v1/books/{id}) */
  async getBook(
    requestParameters: GetBookRequestParams,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<BookResponse> {
    if (requestParameters.id == null) {
      throw new runtime.RequiredError(
        "id",
        'Required parameter "id" was null or undefined when calling getBook().',
      );
    }

    const headerParameters: runtime.HTTPHeaders = {};
    if (this.configuration?.accessToken) {
      headerParameters.Authorization = await this.configuration.accessToken(
        "oauth2",
        [],
      );
    }

    let urlPath = "/api/v1/books/{id}";
    urlPath = urlPath.replace(
      "{id}",
      encodeURIComponent(String(requestParameters.id)),
    );

    const response = await this.request(
      { path: urlPath, method: "GET", headers: headerParameters, query: {} },
      initOverrides,
    );

    return new runtime.JSONApiResponse(response, (jsonValue) =>
      BookResponseFromJSON(jsonValue),
    ).value();
  }

  /** DefaultApi.ts#createLoan と同一のリクエスト内容(POST /api/v1/loans) */
  async createLoan(
    requestParameters: CreateLoanRequestParams,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<LoanResponse> {
    if (requestParameters.xIdempotencyKey == null) {
      throw new runtime.RequiredError(
        "xIdempotencyKey",
        'Required parameter "xIdempotencyKey" was null or undefined when calling createLoan().',
      );
    }
    if (requestParameters.createLoanRequest == null) {
      throw new runtime.RequiredError(
        "createLoanRequest",
        'Required parameter "createLoanRequest" was null or undefined when calling createLoan().',
      );
    }

    const headerParameters: runtime.HTTPHeaders = {
      "Content-Type": "application/json",
      "X-Idempotency-Key": String(requestParameters.xIdempotencyKey),
    };
    if (this.configuration?.accessToken) {
      headerParameters.Authorization = await this.configuration.accessToken(
        "oauth2",
        [],
      );
    }

    const response = await this.request(
      {
        path: "/api/v1/loans",
        method: "POST",
        headers: headerParameters,
        query: {},
        body: CreateLoanRequestToJSON(requestParameters.createLoanRequest),
      },
      initOverrides,
    );

    return new runtime.JSONApiResponse(response, (jsonValue) =>
      LoanResponseFromJSON(jsonValue),
    ).value();
  }
}
