# 📌 프로젝트 시작 전 !!

## 🪵 `branch`

* 각 기능 별로 branch 만들기 (하단 branch 명 규칙 참고)
* 작업 후 **develop branch**에 merge
* 최종적으로, **develop branch**에 merge된 코드들을 **master branch**에 merge


### `branch`, `commit`, `PR` 명 규칙

* branch의 경우, **develop branch**를 source로 하여, Jira에서 만든 **Story의 키**를 기준으로 branch 만들기<br>
ex) S14P21B105-22-function

* commit의 경우, `git commit -m "feat: 특정 기능 개발" -m "S14P21B105-23 특정 기능에 대해서 설명"` 과 같이 작성
    * 여기서의 키는 Story와 연결된 각 이슈의 키
    * `feat` 자리는 `refactor`, `fix` 등 상황에 맞게 변경하여 작성
    * 자세한 설명은 Notion 참고

* PR의 경우, `차량 지도 생성/저장 파이프라인 구축` 같이 추가/수정한 기능을 적은 후, description에 Jira 키 작성
    * 여기서의 키는 Story의 키

---

## 📄 `README.md`
* 해당 코드를 실행시키기 위한 설명이나, 다른 팀원들이 알아야 할 내용 작성


## 🚫 `.gitignore`
1.  [`이 사이트`](https://www.toptal.com/developers/gitignore)에 접속
2. gitignore에 추가해야 할 사항들 검색하여 `.gitignore` 파일에 추가 <br>
ex) 사이트에 접속하여 검색 창에 `Django` 입력 후 생성 버튼을 누르면 나오는 텍스트들 전체 복붙하여 `.gitignore` 파일에 추가

