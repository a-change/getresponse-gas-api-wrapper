##  GetResponse API wrapper for Google Apps Script

This api-wrappie (read in Russian-Australian style as [ə p ɪ   r æ p ɪ]) is designed to allow you to access GetResponse API methods from Google Apps Script with minimal overhead. All functions except for one are direct equivalents for API methods so to get it going you'll need to check with its specifications: https://apidocs.getresponse.com/v3/

Still, I tried to document all the functions [the best I could](https://a-change.github.io/getresponse-gas-api-wrappie/index.html).

#### Installation

1) You can just copy contents of Code.js (with all the comments, ~108kb) or Code.min.js (~21kb) into a separate file in your project

2) Or use it as a library, project id: `MkiUlE8fBzJCI_E3Y01xHDS03q5CrmZYh` (here's how connect a library to your project: https://developers.google.com/apps-script/guides/libraries)

If you use it as a library, give it some short alias and you'll need to start with rather a cumbersome:
```javascript
var gr = new GR.GetResponse('smb', 'api_key'); //given that library's alias is GR
```

#### Usage

In case of SMB accounts, you'll just need you API key:

```javascript
var gr = new GetResponse('smb', 'my super secret api key');
```

In case of entreprise accounts, you'll also need to enter your domain and environment ('pl' or 'us', you can leave it blank if you don't know it):

```javascript
var gr = new GetResponse('enterprise', 'my super secret api key', 'pl', 'email.mydomain.com');
```
or 
```javascript
var gr = new GetResponse('enterprise', 'my super secret api key', 'pl', 'email.mydomain.com');
```

How do you understand if your account is SMB or Enterprise? If you log in via https://getresponse.com (or https://app.getresponse.com), then it's SMB. If you use some other domain, then it's enterprise.

Every response comes in stringified format, so you'll need to parse it before doing something with it. 

Also every response has additional headers which are available via GAS's `getAllHeaders` function, example: 
```{
Transfer-Encoding=chunked, 
totalcount=442, 
Server=nginx, 
x-ratelimit-limit=30000, 
x-unique-id=some_unqiue_id, 
Content-Encoding=gzip, 
currentpage=1, 
totalpages=5, 
x-ratelimit-reset=600 seconds, 
x-ratelimit-remaining=29999, 
Date=Tue, 12 Jun 2018 11:52:07 GMT, 
Content-Type=application/json}
```
`totalcount` here refers to the total number of entities that satisfy the conditions of your request. For example, it can be 442 contacts or newsletters.

How many entities are returned in response for one request is determined by the request's `perPage` parameter which can be 1000 maximum. `totalpages` gives you an idea of how many pages there are when querying API with this or that `perPage` parameter.


##### Examples


###### Adding contacts

```javascript
function addContactsExample() {
  var gr = new GetResponse('enterprise', 'my_super_secret_api_key', 'us', 'my.domain.com');
  //imagine we have a spreadsheet with name, email and phone number columns
  var contacts = SpreadsheetApp.openById('my_spreadsheet_id').getSheets()[1].getDataRange().getValues();
  //there are a few custom fields that contain "phone" in the name, so getting the first one
  //phone numbers should be in +12220002233 format where +1 is country code (+ is required), 222 is regional code and the rest is the number itself. 
  //otherwise the contact will not be added at all (not only the custom field but the contact as a whole)
  var phoneCustom = JSON.parse(gr.getCustomFields({
    query: {
      name: 'phone'
    }
  }))[0];
  //getting the campaign into which contacts should be added
  var campaign = JSON.parse(gr.getCampaigns())[0];
  for (var i in contacts) {
    var body = {
      email: contacts[i][1],
      name: contacts[i][0],
      campaign: {
        campaignId: campaign.campaignId
      },
      customFieldValues: [{
        customFieldId: phoneCustom.customFieldId,
        value: [contacts[i][2]]
      }]
    }
    Logger.log(gr.createContact(body)); //will show empty line in case of success and error message if sth went wrong
  }
}
```

###### Saving contacts' emails and sign-up dates into a spreadsheet

```javascript
function getContactsExampe() {
  var gr = new GetResponse('retail', 'my_super_secret_api_key');
  var query = {
    query: {
      createdOn: {
        from: '2018-01-01',
        to: '2018-03-01'
      },
      origin: ['api', 'import'],
    },
    sort: {
      createdOn: 'desc'
    },
    perPage: 100,
    page: 1
  };
  //the same object as above can set as query string:
  var queryString = '?query[createdOn][form]=2018-01-01&query[createdOn][to]=2018-03-01&query[origin]=api,import&sort[createdOn]=desc&perPage=100&page=1';
  var response = gr.getContacts(query || queryString);
  var headers = response.getAllHeaders();
  var array = [];
  for (query.page; query.page <= headers.totalpages; query.page++) {
    if (query.page > 1) response = gr.getContacts(query);
    var contacts = JSON.parse(response);
    for (var j in contacts) {
      array.push([contacts[j].email, contacts[j].createdOn])
    }
  }
  var sheet = SpreadsheetApp.openById('my_spreadsheet_id').getSheets()[0];
  sheet.getRange(2, 1, array.length, array[0].length).setValues(array); //sets emails and subscription dates into a spreadsheet
}
}
```
###### Saving statistics of a newsletter into a spreadsheet

```javascript
function getStatisticsExample() {
  var gr = new GetResponse('retail', 'my_super_secret_api_key');
  var sheet = SpreadsheetApp.openById('spreadsheet_id').getSheets()[2];
  //getting the campaigns to which newsletters are assigned
  var campaigns = JSON.parse(gr.getCampaigns());
  var campaignIds = campaigns.map(function (campaign) {
    return campaign.campaignId;
  });
  var query = {
    query: {
      campaignId: campaignIds,
      createdOn: {
        from: '2018-01-01'
      },
      groupBy: 'day'
    },
    fields: ['timeInterval', 'totalOpened', 'totalClicked'],
    perPage: 1000,
    page: 1
  };
  //this request will get combined stats for all the newsletters created after 2018-01-01 in the given campaigns, grouped by day
  var newsletterStats = JSON.parse(gr.getNewslettersStats(query));
  //preparing array to insert into spreadsheet
  var newsletterStatsArray = newsletterStats.map(function (stats) {
    return [stats.timeInterval, stats.totalOpened, stats.totalClicked]
  })
  sheet.getRange(2, 1, newsletterStatsArray.length, newsletterStatsArray[0].length).setValues(newsletterStatsArray);
}
```
