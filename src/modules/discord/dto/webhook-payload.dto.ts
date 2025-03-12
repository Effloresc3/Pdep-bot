export class UserDto {
  login: string;
}

export class IssueDto {
  title: string;
  body: string;
  html_url: string;
  user: UserDto;
}

export class CommentDto {
  body: string;
}

export class IssuePayloadDto {
  action: string;
  issue: IssueDto;
  comment?: CommentDto;
}
