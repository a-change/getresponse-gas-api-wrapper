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