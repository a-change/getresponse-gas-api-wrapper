/**
 * GetResponse API wrappie for Google Apps Script
 * @name GetResponse
 * @class GetResponse
 * @param {string} type type of account used, possible values: enterprise|360 for users of GR Enterprise, smb|retail for users of "usual" GR
 * @param {string} apiKey api key which can be obtained and created in the account
 * @param {string} env environment of enterprise account, possible values: pl, us. Not required for SMB accounts
 * @param {string} domain enterprise domain without http(s) and www, not requited for SMB accounts
 * @returns {Object} list of GR API methods 
 */
function GetResponse(type, apiKey, env, domain) {
    function isObject(item) {
        return typeof item === 'object' && item.constructor !== Array && item !== null;
    }

    function getUrl(type, env) {
        var baseUrl = '';
        if (type == '360' || type.toLowerCase() === 'enterprise') {
            if (env.toLowerCase() === 'pl') {
                baseUrl = 'https://api3.getresponse360.pl/v3/';
            } else if (env.toLowerCase() === 'us') {
                baseUrl = 'https://api3.getresponse360.com/v3/';
            } else {
                var check = JSON.parse(checkEnvironment());
                env = check.env;
                return check.baseUrl;
            }
        } else if (type.toLowerCase() === 'retail' || type.toLowerCase() === 'smb') {
            baseUrl = 'https://api.getresponse.com/v3/';
        }
        return baseUrl;

    }
    var baseUrl = getUrl(type, env);

    function checkEnvironment() {
        if (type === 'retail') {
            return this.get('accounts');
        }
        var envs = [{
                env: 'pl',
                domain: domain,
                type: 'enterprise',
                baseUrl: 'https://api3.getresponse360.pl/v3/'
            },
            {
                env: 'us',
                domain: domain,
                type: 'enterprise',
                baseUrl: 'https://api3.getresponse360.com/v3/'
            }
        ];
        for (var i in envs) {

            var response = sendRequest_(envs[i].type, envs[i].env, apiKey, envs[i].domain, envs[i].baseUrl, 'accounts', 'get', '');
            var responseCode = response.getResponseCode();
            if (response.httpStatus === 404 && response.message === 'Incorrect environment') {
                continue;
            } else {
                response = JSON.parse(response);
                if (responseCode <= 299) {
                    env = envs[i].env;
                    return JSON.stringify(envs[i]);
                }
            }
        }
        return JSON.stringify({
            error: true,
            code: '0',
            httpStatus: 404,
            message: 'No matching environment: probably an SMB account or just wrong credentials'
        });
    };

    function sendRequest_(type, env, apiKey, domain, baseUrl, request, method, body) {

        var url = baseUrl + request;
        var headers = {
            'X-Auth-Token': 'api-key ' + apiKey
        };

        if (domain) headers['X-DOMAIN'] = domain;

        var options = {
            headers: headers,
            contentType: 'application/json',
            method: method,
            payload: body,
            muteHttpExceptions: true
        };
        Logger.log(url);
        var response = UrlFetchApp.fetch(url, options);
        var responseCode = response.getResponseCode();

        //If GR360 credentials contain wrong environment code or wrong domain, an html page will be returned.
        //If this happens, an error object is created to be returned later on
        var responseString = response.toString();
        if (responseString.indexOf('<!DOCTYPE html>') != -1) {
            response = {
                error: true,
                code: '0',
                httpStatus: 404,
                getResponseCode: function () {
                    return 404;
                },
                message: 'Incorrect environment'
            };
        }
        return response;
    }

    // Written by Amit Agarwal www.labnol.org

    function uploadFile_(type, env, apiKey, domain, baseUrl, blob) {

        var url = baseUrl + "multimedia/";
        if (!domain) domain = "";

        var headers = {
            "X-DOMAIN": domain,
            "X-Auth-Token": "api-key " + apiKey
        };
        var boundary = "labnol";

        var attributes = "{\"name\":\"" + blob.getName() + "\"}";

        var requestBody = Utilities.newBlob(
                "--" + boundary + "\r\n" +
                "Content-Disposition: form-data; name=\"attributes\"\r\n\r\n" +
                attributes + "\r\n" + "--" + boundary + "\r\n" +
                "Content-Disposition: form-data; name=\"file\"; filename=\"" + blob.getName() + "\"\r\n" +
                "Content-Type: " + blob.getContentType() + "\r\n\r\n").getBytes()
            .concat(blob.getBytes())
            .concat(Utilities.newBlob("\r\n--" + boundary + "--\r\n").getBytes());

        var options = {
            "method": "post",
            "contentType": "multipart/form-data; boundary=" + boundary,
            "payload": requestBody,
            "muteHttpExceptions": false,
            "headers": headers
        };

        var response = UrlFetchApp.fetch(url, options);

        Logger.log(response.getContentText());
        return response;
    }

    function prepareRequest(request, parameters) {
        request = request.trim();
        if (request[request.length - 1] !== '/') {
            request += '/';
        }
        if (parameters) {
            request += queryGenerator(parameters);
        }
        return request;
    }

    function queryGenerator(parameters) {
        if (parameters === undefined) {
            return '';
        }
        if (typeof parameters === 'string' && parameters[0] === '?') {
            return parameters;
        }
        var queryString = '?';
        if (isObject(parameters.query)) {
            for (var i in parameters.query) {
                if (i === 'createdOn' || i === 'sendOn' || i === 'changedOn') {
                    for (var j in parameters.query[i]) {
                        if (!parameters.query[i][j]) continue;
                        queryString +=
                            'query[' + i + '][' + j + ']=' + encodeURIComponent(parameters.query[i][j]) + '&';
                    }
                } else {
                    queryString += 'query[' + i + ']=' + encodeURIComponent(parameters.query[i]) + '&';
                }
            }
        }
        if (isObject(parameters.sort)) {
            for (var k in parameters.sort) {
                if (!parameters.sort[k]) continue
                queryString += 'sort[' + k + ']=' + encodeURIComponent(parameters.sort[k]) + '&';
            }
        }
        for (var k in parameters) {
            if (!parameters[k]) continue;
            if (k !== 'query' && k !== 'sort') {
                queryString += k + '=' + encodeURIComponent(parameters[k]) + '&';
            }
        }
        return queryString;
    }
    var self = {
        apiKey: apiKey,
        type: type || 'retail',
        env: env || '',
        domain: domain || '',
        baseUrl: baseUrl,
        get: function (request, parameters) {
            var method = 'get';
            request = prepareRequest(request, parameters);
            return sendRequest_(this.type, this.env, this.apiKey, this.domain, this.baseUrl, request, method, '');
        },
        post: function (request, body) {
            var method = 'post';
            return sendRequest_(this.type, this.env, this.apiKey, this.domain, this.baseUrl, request, method, JSON.stringify(body));
        },
        remove: function (request, parameters) {
            var method = 'delete';
            request = prepareRequest(request, parameters);
            return sendRequest_(this.type, this.env, this.apiKey, this.domain, this.baseUrl, request, method, '');
        },
        upload: function (blob) {
            return uploadFile_(this.type, this.env, this.apiKey, this.domain, this.baseUrl, blob);
        }
    };
    var methods = {};
    methods.queryGenerator = queryGenerator;
    /**
     * @memberof GetResponse#
     * @namespace contacts
     */
    /**
     * @name getContacts
     * @description gets list of contacts according to parameters
     * @see {@link https://apidocs.getresponse.com/v3/resources/contacts#contacts.get.all}
     * @memberof GetResponse#
     * @method getContacts
     * @param {Object | string} parameters query parameters as object or as query string
     * @example 
     * var query = {
     *  query: {
     *      createdOn: {
     *          from: '2018-01-01',
     *          to: '2018-03-01'
     *      },
     *      origin: 'api',
     *  },
     *  sort: {
     *      createdOn: 'desc'
     *  },
     *  perPage: 1000,
     *  page: 1
     * };
     * //the same object as above can set as query string:
     * var queryString = '?query[createdOn][form]=2018-01-01&query[createdOn][to]=2018-03-01&query[origin]=api&sort[createdOn]=desc&perPage=1000&page=1';
     * var contacts = JSON.parse(gr.contacts.get(query));
     * var sheet = SpreadsheetApp.getActiveSheet();
     * var array = [];
     * for (var i in contacts) {
     *   array.push([contacts[i].email, contacts[i].createdOn]);
     * }
     * sheet.getRange(2, 1, array.length, array[0].length).setValues(array); //sets emails and subscription dates into a spreadsheet
     * @returns {array} array of contact objects
     */
    methods.getContacts = function (parameters) {
        return self.get('contacts', parameters);
    }
    /**
     * @name getContact
     * @description get a single contact object by its id
     * @see {@link https://apidocs.getresponse.com/v3/resources/contacts#contacts.get}
     * @memberof GetResponse#
     * @method contacts#getContact
     * @param {string} contactId contact's id obtained via {@link GetResponse#contacts#getContacts getContacts} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned.
     * @returns {object} contact
     */
    methods.getContact = function (contactId, fields) {
        return self.get('contacts/' + contactId, {
            fields: fields
        });
    }
    /**
     * @name create
     * @description create a new contact
     * @see {@link https://apidocs.getresponse.com/v3/resources/contacts#contacts.create}
     * @memberof GetResponse#
     * @method contacts#createContact
     * @param {object} contact contact object
     * @returns {object} newly created contact object
     */
    methods.createContact = function (contact) {
        return self.post('contacts', contact);
    }
    /**
     * @name update
     * @description updates contact
     * @see {@link https://apidocs.getresponse.com/v3/resources/contacts#contacts.update}
     * @memberof GetResponse#
     * @method contacts#updateContact
     * @param {string} contactId contact's id obtained via {@link GetResponse#contacts#getContacts getContacts} method
     * @param {object} contact contact object
     * @returns {object} updated contact
     */
    methods.updateContact = function (contactId, contact) {
        return self.post('contacts/' + contactId, contact);
    }
    /**
     * @name updateContactCustoms
     * @description update contact custom
     * @see {@link https://apidocs.getresponse.com/v3/resources/contacts#contacts.upsert.custom-fields}
     * @memberof GetResponse#
     * @method contacts#updateContactCustoms
     * @param {string} contactId contact's id obtained via {@link GetResponse#contacts#getContacts getContacts} method
     * @param {array} customs array of {@link GetResponse#customFields custom field} objects
     * @returns {object} updated contact
     */
    methods.updateContactCustoms = function (contactId, customs) {
        return self.post('contacts/' + contactId + '/custom-fields', {
            customFieldValues: customs
        });
    }
    /**
     * @name updateContactTags
     * @description update contact tags
     * @see {@link https://apidocs.getresponse.com/v3/resources/contacts#contacts.upsert.tags}
     * @memberof GetResponse#
     * @method contacts#updateContactTags
     * @param {string} contactId contact's id obtained via {@link GetResponse#contacts#getContacts getContacts} method
     * @param {array} tags array of {@link GetResponse#tags tag} objects
     * @returns {object} updated contact
     */
    methods.updateContactTags = function (contactId, tags) {
        return self.post('contacts/' + contactId + '/tags', {
            tags: tags
        });
    }
    /**
     * @name getContactActivities
     * @description gets activities of a contacts
     * @see {@link https://apidocs.getresponse.com/v3/resources/contacts#contacts.get.activities}
     * @memberof GetResponse#
     * @method contacts#getContactActivities
     * @param {string} contactId contact's id obtained via {@link GetResponse#contacts#getContacts getContacts} method
     * @param {object|string} parameters query parameters set as object or query string
     * @returns array of contact activities
     */
    methods.getContactActivities = function (contactId, parameters) {
        return self.get('contacts/' + contactId + '/activities', parameters);
    }
    /**
     * @name deleteContact
     * @description deletes a contact by id
     * @see {@link https://apidocs.getresponse.com/v3/resources/contacts#contacts.delete}
     * @memberof GetResponse#
     * @method contacts#deleteContact
     * @param {string} contactId contact's id obtained via {@link GetResponse#contacts#getContacts getContacts} method
     * @param {object} parameters in this case parameters may include: messageId, ipAddress and reason which can be equal to 'api' or 'unsubscribe'
     */
    methods.deleteContact = function (contactId, parameters) {
        return self.remove('contacts/' + contactId, parameters);
    }
    /**
     * @memberof GetResponse#
     * @namespace newsletters
     */
    /**
     * @name getNewsletters
     * @description gets the list of newsletters 
     * @see {@link https://apidocs.getresponse.com/v3/resources/newsletters#newsletters.get.all}
     * @memberof GetResponse#
     * @method newsletters#getNewsletters
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of newsletters
     */
    methods.getNewsletters = function (parameters) {
        return self.get('newsletters', parameters);
    }
    /**
     * @name getNewsletter
     * @description gets one newsletter object with explicit information about it
     * @see {@link https://apidocs.getresponse.com/v3/resources/newsletters#newsletters.get}
     * @memberof GetResponse#
     * @method newsletters#getNewsletter
     * @param {string} newsletterId newsletter's id obtained via {@link GetResponse#newsletters#getNewsletters getNewsletters} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned.
     * @returns {object} newsletter
     */
    methods.getNewsletter = function (newsletterId, fields) {
        return self.get('newsletters/' + newsletterId, {
            fields: fields
        });
    }
    /**
     * @name getNewslettersStats
     * @description returns combined statistics of one or more newsletters
     * @see {@link https://apidocs.getresponse.com/v3/resources/newsletters#newsletters.statistics.get.all}
     * @memberof GetResponse#
     * @method newsletters#getNewslettersStats
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} statistics
     */
    methods.getNewslettersStats = function (parameters) {
        return self.get('newsletters/statistics', parameters);
    }
    /**
     * @name getNewsletterStats
     * @description returns statistics of one newsletter according to params
     * @see {@link https://apidocs.getresponse.com/v3/resources/newsletters#newsletters.statistics.get}
     * @memberof GetResponse#
     * @method newsletters#getNewsletterStats
     * @param {string} newsletterId newsletter's id obtained via {@link GetResponse#newsletters#getNewsletters getNewsletters} method
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} statistics
     */
    methods.getNewsletterStats = function (newsletterId, parameters) {
        return self.get('newsletter/' + newsletterId + '/statisitcs', parameters);
    }
    /**
     * @name createNewsletter
     * @description creates draft and newsletters
     * @see {@link https://apidocs.getresponse.com/v3/resources/newsletters#newsletters.create}
     * @memberof GetResponse#
     * @method newsletters#createNewsletter 
     * @param {object} newsletter newsletter object
     * @returns {object} newsletter object
     */
    methods.createNewsletter = function (newsletter) {
        return self.post('newsletters', newsletter);
    }
    /**
     * @name sendDraft
     * @description sends a previously created draft immediately or schedules it for the necessary tome
     * @see {@link https://apidocs.getresponse.com/v3/resources/newsletters#newsletters.send.draft}
     * @memberof GetResponse#
     * @method newsletters#sendDraft
     * @param {object} draftSettings setting of the draft: messageId and sending settings, like time, recipients' ids, etc.
     * @returns {object} newsletter object
     */
    methods.sendDraft = function (draftSettings) {
        return self.post('send-draft', draftSettings);
    }
    /**
     * @name cancelNewsletter
     * @description cancels a scheduled or currently sending messages
     * @see {@link https://apidocs.getresponse.com/v3/resources/newsletters#newsletters.cancel}
     * @memberof GetResponse#
     * @method newsletters#cancelNewsletter
     * @param {string} newsletterId newsletter's id obtained via {@link GetResponse#newsletters#getNewsletters getNewsletters} method
     */
    methods.cancelNewsletter = function (newsletterId) {
        return self.post('newsletters/' + newsletterId);
    }
    /**
     * @name deleteNewsletter
     * @description deletes a newsletter by its id
     * @see {@link https://apidocs.getresponse.com/v3/resources/newsletters#newsletters.delete}
     * @memberof GetResponse#
     * @method newsletters#deleteNewsletter
     * @param {string} newsletterId newsletter's id obtained via {@link GetResponse#newsletters#getNewsletters getNewsletters} method
     */
    methods.deleteNewsletter = function (newsletterId) {
        return self.remove('newsletters/' + newsletterId);
    }
    /**
     * @memberof GetResponse#
     * @namespace campaigns
     */
    /**
     * @name getCampaigns
     * @description get list of campaigns with some information about them
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.get.all}
     * @memberof GetResponse#
     * @method campaigns#getCampaigns
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} collection of campaigns
     */
    methods.getCampaigns = function (parameters) {
        return self.get('campaigns', parameters);
    }
    /**
     * @name getCampaign
     * @description get full information about a campaign
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.get}
     * @memberof GetResponse#
     * @method campaigns#getCampaign
     * @param {string} campaignId campaign's id obtained via {@link GetResponse#campaigns#getCampaigns getCampaigns} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned.
     * @returns {object} campaign
     */
    methods.getCampaign = function (campaignId, fields) {
        return self.get('campaigns/' + campaignId, {
            fields: fields
        });
    }
    /**
     * @name getCampaignContacts
     * @description get list of contacts subscribed to this campaign
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.contacts.get}
     * @memberof GetResponse#
     * @method campaigns#getCampaignContacts
     * @param {string} campaignId campaign's id obtained via {@link GetResponse#campaigns#getCampaigns getCampaigns} method
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} collection of contacts
     */
    methods.getCampaignContacts = function (campaignId, parameters) {
        return self.get('campaigns/' + campaignId + '/contacts', parameters);
    }
    /**
     * @name getCampaignBlacklist
     * @description get list of masks from the campaign's blacklist
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.blacklists.get}
     * @memberof GetResponse#
     * @method campaigns#getCampaignBlacklist
     * @param {string} campaignId campaign's id obtained via {@link GetResponse#campaigns#getCampaigns getCampaigns} method
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {object} object which contains the array with blacklisted masks
     */
    methods.getCampaignBlacklist = function (campaignId, parameters) {
        return self.get('campaigns/' + campaignId + '/blacklists', parameters);
    }
    /**
     * @name getCampaignsListSize
     * @description get statistics on the number of emails in the specified campaign(s)
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.statistics.list-size}
     * @memberof GetResponse#
     * @method campaigns#getCampaignsListSize
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} collection of objects with statistics on list size for specified campaigns
     */
    methods.getCampaignsListSize = function (parameters) {
        return self.get('campaigns/statistics/list-size', parameters);
    }
    /**
     * @name getCampaignsLocations 
     * @description get statistics on locations of subscribers in specified campaigns
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.statistics.locations}
     * @memberof GetResponse#
     * @method campaigns#getCampaignsLocations 
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} collection of campaign locations
     */
    methods.getCampaignsLocations = function (parameters) {
        return self.get('campaigns/statistics/locations', parameters);
    }
    /**
     * @name getCampaignsOrigins
     * @description get statistics on subscription methods for specified campaigns
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.statistics.origins}
     * @memberof GetResponse#
     * @method campaigns#getCampaignsOrigins
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} collection of statistics objects
     */
    methods.getCampaignsOrigins = function (parameters) {
        return self.get('campaigns/statistics/origins', parameters);
    }
    /**
     * @name getCampaignsRemovals
     * @description get statistics on unsubscribes and other removals from specified campaigns
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.statistics.removals}
     * @memberof GetResponse#
     * @method campaigns#getCampaignsRemovals
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} collection of statistics objects
     */
    methods.getCampaignsRemovals = function (parameters) {
        return self.get('campaigns/statistics/removals', parameters);
    }
    /**
     * @name getCampaignsSubscriptions
     * @description get statistics on subscriptions to specified campaigns
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.statistics.subscriptions}
     * @memberof GetResponse#
     * @method campaigns#getCampaignsSubscriptions
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} collection of statistics objects
     */
    methods.getCampaignsSubscriptions = function (parameters) {
        return self.get('campaigns/statistics/subscriptions', parameters);
    }
    /**
     * @name getCampaignsBalance
     * @description get statistics on removals from and subscriptions to specified campaigns
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.get.balance}
     * @memberof GetResponse#
     * @method campaigns#getCampaignsBalance
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} collection of statistics objects
     */
    methods.getCampaignsBalance = function (parameters) {
        return self.get('campaigns/statistics/balance', parameters);
    }
    /**
     * @name getCampaignsSummary
     * @description get current basic statistics of specified campaigns
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.get.summary}
     * @memberof GetResponse#
     * @method campaigns#getCampaignsSummary
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} collection of statistics objects
     */
    methods.getCampaignsSummary = function (parameters) {
        return self.get('campaigns/statistics/summary', parameters);
    }
    /**
     * @name createCampaign
     * @description create a new campaign
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.create}
     * @memberof GetResponse#
     * @method campaigns#createCampaign
     * @param {object} campaign campaign settings
     * @returns {object} campaign object
     */
    methods.createCampaign = function (campaign) {
        return self.post('campaigns', campaign);
    }
    /**
     * @name updateCampaign
     * @description updates a campaign
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.update}
     * @memberof GetResponse#
     * @method campaigns#updateCampaign
     * @param {string} campaignId campaign's id obtained via {@link GetResponse#campaigns#getCampaigns getCampaigns} method
     * @param {object} settings campaign settings
     * @returns {object} campaign object
     */
    methods.updateCampaign = function (campaignId, settings) {
        return self.post('campaigns/' + campaignId, settings);
    }
    /**
     * @name updateCampaignBlacklist
     * @description replace masks in the campaign blacklist with the new ones
     * @see {@link https://apidocs.getresponse.com/v3/resources/campaigns#campaigns.blacklists.update}
     * @memberof GetResponse#
     * @method campaigns#updateCampaignBlacklist
     * @param {string} campaignId campaign's id obtained via {@link GetResponse#campaigns#getCampaigns getCampaigns} method
     * @param {array} masks array of masks to add into blacklists. Masks should always contain @ character
     * @returns {object} object with newly added masks
     */
    methods.updateCampaignBlacklist = function (campaignId, masks) {
        return self.post('campaign/' + campaignId + '/blacklists', {
            masks: masks
        });
    }

    /**
     * @memberof GetResponse#
     * @namespace autoresponders
     */
    /**
     * @name getAutoresponders
     * @description gets the list of autoresponders
     * @see {@link https://apidocs.getresponse.com/v3/resources/autoresponders#autoresponders.get.all}
     * @memberof GetResponse#
     * @method autoresponders#getAutoresponders
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} collection of autoresponder objects
     */
    methods.getAutoresponders = function (parameters) {
        return self.get('autoresponders', parameters);
    }
    /**
     * @name getAutoresponder
     * @description get full info about one autoresponder
     * @see {@link https://apidocs.getresponse.com/v3/resources/autoresponders#autoresponders.get}
     * @memberof GetResponse#
     * @method autoresponders#getAutoresponder
     * @param {string} autoresponderId autoresponder's id obtained via {@link GetResponse#autoresponders#getAutoresponders getAutoresponders} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned.
     * @returns {object} autoresponder object
     */
    methods.getAutoresponder = function (autoresponderId, fields) {
        return self.get('autoresponders/' + autoresponderId, {
            fields: fields
        });
    }
    /**
     * @name getAutorespondersStats
     * @description get statistics of one or more autoresponders
     * @see {@link https://apidocs.getresponse.com/v3/resources/autoresponders#autoresponders.statistics.get.all}
     * @memberof GetResponse#
     * @method autoresponders#getAutorespondersStats
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} collection of statistics objects
     */
    methods.getAutorespondersStats = function (parameters) {
        return self.get('autoresponders/statistics', parameters);
    }
    /**
     * @name getAutoresponderStats
     * @description get statistics of one autoresponder
     * @see {@link https://apidocs.getresponse.com/v3/resources/autoresponders#autoresponders.statistics.get}
     * @memberof GetResponse#
     * @method autoresponders#getAutoresponderStats
     * @param {string} autoresponderId autoresponder's id obtained via {@link GetResponse#autoresponders#getAutoresponders getAutoresponders} method
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} collection of statistics objects
     */
    methods.getAutoresponderStats = function (autoresponderId, parameters) {
        return self.get('autoresponders/' + autoresponderId + '/statistics', parameters);
    }
    /**
     * @name getAutoresponderThumbnail
     * @description get thumbnail of an autoresponder
     * @see {@link https://apidocs.getresponse.com/v3/resources/autoresponders#autoresponders.get.thumbnail}
     * @memberof GetResponse#
     * @method autoresponders#getAutoresponderThumbnail
     * @param {string} autoresponderId autoresponder's id obtained via {@link GetResponse#autoresponders#getAutoresponders getAutoresponders} method
     * @param {string} size size of the thumbnail to be returned. Possible values: default, small
     * @returns thumbnail
     */
    methods.getAutoresponderThumbnail = function (autoresponderId, size) {
        return self.get('autoresponders/' + autoresponderId + '/thumbnail', {
            size: size
        });
    }
    /**
     * @name createAutoresponder
     * @description creates an autoresponder
     * @see {@link https://apidocs.getresponse.com/v3/resources/autoresponders#autoresponders.create}
     * @memberof GetResponse#
     * @method autoresponders#createAutoresponder
     * @param {object} autoresponder autoresponder object
     * @returns {object} autoresponder object
     */
    methods.createAutoresponder = function (autoresponder) {
        return self.post('autoresponders', autoresponder);
    }
    /**
     * @name updateAutoresponder
     * @description updates an autoresponder
     * @see {@link https://apidocs.getresponse.com/v3/resources/autoresponders#autoresponders.update}
     * @memberof GetResponse#
     * @method autoresponders#updateAutoresponder
     * @param {string} autoresponderId autoresponder's id obtained via {@link GetResponse#autoresponders#getAutoresponders getAutoresponders} method
     * @param {object} autoresponderSettings autoresponder object
     * @returns {object} autoresponder object
     */
    methods.updateAutoresponder = function (autoresponderId, autoresponderSettings) {
        return self.post('autoresponders/' + autoresponderId, autoresponderSettings);
    }
    /**
     * @name deleteAutoresponder
     * @description deletes an autoresponder
     * @see {@link https://apidocs.getresponse.com/v3/resources/autoresponders#autoresponders.delete}
     * @memberof GetResponse#
     * @method autoresponders#deleteAutoresponder
     * @param {string} autoresponderId autoresponder's id obtained via {@link GetResponse#autoresponders#getAutoresponders getAutoresponders} method
     */
    methods.deleteAutoresponder = function (autoresponderId) {
        return self.remove('autoresponders/' + autoresponderId);
    }

    /**
     * @memberof GetResponse#
     * @namespace rssNewsletters
     */
    /**
     * @description gets the list of RSS newsletters
     * @see {@link https://apidocs.getresponse.com/v3/resources/rss-newsletters#rss-newsletters#get.all}
     * @memberof GetResponse#
     * @method rssNewsletters#getRssNewsletters
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} list of RSS newsletter objects
     */
    methods.getRssNewsletters = function (parameters) {
        return self.get('rss-newsletters', parameters);
    }
    /**
     * @description gets full info about one RSS newsletter
     * @see {@link https://apidocs.getresponse.com/v3/resources/rss-newsletters#rss-newsletters.get}
     * @memberof GetResponse#
     * @method rssNewsletters#getRssNewsletter
     * @param {string} newsletterId RSS newsletter's id obtained via {@link GetResponse#rssNewsletters#getRssNewsletters getRssNewsletters} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned.
     * @returns {object} RSS newsletter object
     */
    methods.getRssNewsletter = function (newsletterId, fields) {
        return self.get('rss-newsletters/' + newsletterId, {
            fields: fields
        });
    }
    /**
     * @description gets statistics combined on one or more RSS newsletters
     * @see {@link https://apidocs.getresponse.com/v3/resources/rss-newsletters#rss-newsletters.statistics.get.all}
     * @memberof GetResponse#
     * @method rssNewsletters#getRssNewslettersStats
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of statistics objects
     */
    methods.getRssNewslettersStats = function (parameters) {
        return self.get('rss-newsletters/statistics', parameters);
    }
    /**
     * @description get statistics on one RSS newsletter
     * @see {@link https://apidocs.getresponse.com/v3/resources/rss-newsletters#rss-newsletters#statistics.get}
     * @memberof GetResponse#
     * @method rssNewsletters#getRssNewsletterStats
     * @param {string} newsletterId RSS newsletter's id obtained via {@link GetResponse#rssNewsletters#getRssNewsletters getRssNewsletters} method
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of statistics objects
     */
    methods.getRssNewsletterStats = function (newsletterId, parameters) {
        return self.get('rss-newsletters/' + newsletterId + '/statistics', parameters);
    }
    /**
     * @description creates a new RSS newsletter according to parameters
     * @see {@link https://apidocs.getresponse.com/v3/resources/rss-newsletters#rss-newsletters#create}
     * @memberof GetResponse#
     * @method rssNewsletters#createRssNewsletter
     * @param {object} newsletter newsletter object
     * @returns {object} newly created newsletter object
     */
    methods.createRssNewsletter = function (newsletter) {
        return self.post('rss-newsletters', newsletter);
    }
    /**
     * @description updates an RSS newsletter
     * @see {@link https://apidocs.getresponse.com/v3/resources/rss-newsletters#rss-newsletters#update}
     * @memberof GetResponse#
     * @method rssNewsletters#updateRssNewsletter
     * @param {string} newsletterId RSS newsletter's id obtained via {@link GetResponse#rssNewsletters#getRssNewsletters getRssNewsletters} method
     * @param {object} newsletter newsletter object
     * @returns {object} updated newsletter object
     */
    methods.updateRssNewsletter = function (newsletterId, newsletter) {
        return self.post('rss-newsletters/' + newsletterId, newsletter);
    }
    /**
     * @description deletes an RSS newsletter
     * @see {@link https://apidocs.getresponse.com/v3/resources/rss-newsletters#rss-newsletters#delete}
     * @memberof GetResponse#
     * @method rssNewsletters#deleteRssNewsletter
     * @param {string} newsletterId RSS newsletter's id obtained via {@link GetResponse#rssNewsletters#getRssNewsletters getRssNewsletters} method
     */
    methods.deleteRssNewsletter = function (newsletterId) {
        return self.remove('rss-newsletters/' + newsletterId);
    }

    /**
     * @memberof GetResponse#
     * @namespace fromFields
     */
    /**
     * @description gets from fields that are accessible in the account
     * @see {@link https://apidocs.getresponse.com/v3/resources/fromfields#fromfields.get.all}
     * @memberof GetResponse#
     * @method fromFields#getFromFields
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of from fields objects
     */
    methods.getFromFields = function (parameters) {
        return self.get('from-fields', parameters);
    }
    /**
     * @description gets full info about one from field
     * @see {@link https://apidocs.getresponse.com/v3/resources/fromfields#fromfields.get}
     * @memberof GetResponse#
     * @method fromFields#getFromField
     * @param {string} fromFieldId from field's id obtained via {@link GetResponse#fromFields#getFromFields getFromFields} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned.
     * @returns {object} from field object
     */
    methods.getFromField = function (fromFieldId, fields) {
        return self.get('from-fields/' + fromFieldId, {
            fields: fields
        });
    }
    /**
     * @description creates a new from field
     * @see {@link https://apidocs.getresponse.com/v3/resources/fromfields#fromfields.create}
     * @memberof GetResponse#
     * @method fromFields#createFromField
     * @param {string} email email of the from field
     * @param {string} name name of the from field
     * @returns {object} newly created from field
     */
    methods.createFromField = function (email, name) {
        return self.post('from-fields', {
            email: email,
            name: name
        })
    }
    /**
     * @description sets from field as default
     * @see {@link https://apidocs.getresponse.com/v3/resources/fromfields#fromfields.default}
     * @memberof GetResponse#
     * @method fromFields#setFromFieldAsDefault
     * @param {string} fromFieldId from field's id obtained via {@link GetResponse#fromFields#getFromFields getFromFields} method
     * @returns {object} updated from field object
     */
    methods.setFromFieldAsDefault = function (fromFieldId) {
        return self.post('from-fields/' + fromFieldId + '/default');
    }
    /**
     * @description deletes a from field
     * @see {@link https://apidocs.getresponse.com/v3/resources/fromfields#fromfields.delete}
     * @memberof GetResponse#
     * @method fromFields#deleteFromField
     * @param {string} fromFieldIdToRemove from field's (which is to be removed) id obtained via {@link GetResponse#fromFields#getFromFields getFromFields} method
     * @param {string} fromFieldIdToReplaceWith from field's (which is to replace the removed one in newsletters and autoresponders) id obtained via {@link GetResponse#fromFields#getFromFields getFromFields} method
     * @returns {number} statusCode
     */
    methods.deleteFromField = function (fromFieldIdToRemove, fromFieldIdToReplaceWith) {
        return self.remove('from-fields/' + fromFieldIdToRemove, '', {
            fromFieldIdToReplaceWith: fromFieldIdToReplaceWith
        });
    }

    /**
     * @memberof GetResponse#
     * @namespace customFields
     */
    /**
     * @description gets list of available custom fields
     * @see {@link https://apidocs.getresponse.com/v3/resources/customfields#customfields.get.all}
     * @memberof GetResponse#
     * @method customFields#getCustomFields
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of custom field objects
     */
    methods.getCustomFields = function (parameters) {
        return self.get('custom-fields', parameters);
    }
    /**
     * @description gets full info about one custom field
     * @see {@link https://apidocs.getresponse.com/v3/resources/customfields#customfields.get}
     * @memberof GetResponse#
     * @method customFields#getCustomField
     * @param {string} customFieldId custom field's id obtained via {@link GetResponse#customFields#getCustomFields getCustomFields} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @returns {object} custom field object
     */
    methods.getCustomField = function (customFieldId, fields) {
        return self.get('custom-fields/' + customFieldId, {
            fields: fields
        });
    }
    /**
     * @description creates a new custom field
     * @see {@link https://apidocs.getresponse.com/v3/resources/customfields#customfields.create}
     * @memberof GetResponse#
     * @method customFields#createCustomField
     * @param {object} customField object with custom field settings (see GR API docs site for more info)
     * @returns {object} newly created custom field object
     */
    methods.createCustomField = function (customField) {
        return self.post('custom-fields', customField);
    }
    /**
     * @description updates values and/or visibility of a custom field (it's not possible to update its type, format or name after creation)
     * @see {@link https://apidocs.getresponse.com/v3/resources/customfields#customfields.update}
     * @memberof GetResponse#
     * @method customFields#updateCustomField
     * @param {string} customFieldId custom field's id obtained via {@link GetResponse#customFields#getCustomFields getCustomFields} method
     * @param {object} customFieldSettings
     * @returns {object} updated custom field object
     */
    methods.updateCustomField = function (customFieldId, customFieldSettings) {
        return self.post('custom-fields/' + customFieldId, customFieldSettings);
    }
    /**
     * @description delete a custom field
     * @see {@link https://apidocs.getresponse.com/v3/resources/customfields#customfields.delete}
     * @memberof GetResponse#
     * @method customFields#deleteCustomField
     * @param {string} customFieldId custom field's id obtained via {@link GetResponse#customFields#getCustomFields getCustomFields} method
     */
    methods.deleteCustomField = function (customFieldId) {
        return self.remove('custom-fields/' + customFieldId);
    }

    /**
     * @memberof GetResponse#
     * @namespace tags
     */
    /**
     * @description gets list of available tags
     * @see {@link https://apidocs.getresponse.com/v3/resources/tags#tags.get.all}
     * @memberof GetResponse#
     * @method tags#getTags
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} list of tag objects
     */
    methods.getTags = function (parameters) {
        return self.get('tags', parameters);
    }
    /**
     * @description gets info about one tag
     * @see {@link https://apidocs.getresponse.com/v3/resources/tags#tags.get}
     * @memberof GetResponse#
     * @method tags#getTag
     * @param {string} tagId tag's id obtained via {@link GetResponse#tags#getTags getTags} method
     * @param {object|string} parameters
     * @returns {object} tag object
     */
    methods.getTag = function (tagId, parameters) {
        return self.get('tags/' + tagId, parameters);
    }
    /**
     * @description create a new tag; right now it's only possible to set its name and nothing more
     * @see {@link https://apidocs.getresponse.com/v3/resources/tags#tags.post}
     * @memberof GetResponse#
     * @method tags#createTag
     * @param {string} tagName name of the new tag
     * @returns {object} newly created tag object
     */
    methods.createTag = function (tagName) {
        return self.post('tags', {
            name: tagName
        });
    }
    /**
     * @description updates a tag; right now it's only possible to change its name and nothing more
     * @see {@link https://apidocs.getresponse.com/v3/resources/tags#tags.put}
     * @memberof GetResponse#
     * @method tags#updateTag
     * @param {string} tagId tag's id obtained via {@link GetResponse#tags#getTags getTags} method
     * @param {string} tagName new tag name
     * @returns {object} updated tag object
     */
    methods.updateTag = function (tagId, tagName) {
        return self.post('tags/' + tagId, {
            name: tagName
        });
    }
    /**
     * @description deletes a tag
     * @see {@link https://apidocs.getresponse.com/v3/resources/tags#tags.delete}
     * @memberof GetResponse#
     * @method tags#deleteTag
     * @param {string} tagId tag's id obtained via {@link GetResponse#tags#getTags getTags} method
     * @returns {number} status code
     */
    methods.deleteTag = function (tagId) {
        return self.remove('tags/' + tagId);
    }

    /**
     * @memberof GetResponse#
     * @namespace webinars
     */
    /**
     * @description gets list of webinars that have been created in the account
     * @see {@link https://apidocs.getresponse.com/v3/resources/conferences#conferences.get.all}
     * @memberof GetResponse#
     * @method webinars#getWebinars
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of webinar objects
     */
    methods.getWebinars = function (parameters) {
        return self.get('webinars', parameters);
    }
    /**
     * @description gets info about one webinar
     * @see {@link https://apidocs.getresponse.com/v3/resources/conferences#conferences.get}
     * @memberof GetResponse#
     * @method webinars#getWebinar
     * @param {string} webinarId webinar's id obtained via {@link GetResponse#webinars#getWebinars getWebinars} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @returns {object} webinar object
     */
    methods.getWebinar = function (webinarId, fields) {
        return self.get('webinars/' + webinarId, {
            fields: fields
        });
    }

    /**
     * @memberof GetResponse#
     * @namespace forms
     */
    /**
     * @description gets list of forms
     * @see {@link https://apidocs.getresponse.com/v3/resources/forms#forms.get.all}
     * @memberof GetResponse#
     * @method forms#getForms
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of form objects
     */
    methods.getForms = function (parameters) {
        return self.get('forms', parameters);
    }
    /**
     * @description gets info about one form
     * @see {@link https://apidocs.getresponse.com/v3/resources/forms#forms.get}
     * @memberof GetResponse#
     * @method forms#getForm
     * @param {string} formId form's id obtained via {@link GetResponse#forms#getForms getForms} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @returns {object} form object
     */
    methods.getForm = function (formId, fields) {
        return self.get('forms/' + formId, {
            fields: fields
        });
    }
    /**
     * @description gets list of a form's variants
     * @see {@link https://apidocs.getresponse.com/v3/resources/forms#forms.get.variants}
     * @memberof GetResponse#
     * @method forms#getFormVariants
     * @param {string} formId form's id obtained via {@link GetResponse#forms#getForms getForms} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @returns {array} array of form variant objects
     */
    methods.getFormVariants = function (formId, fields) {
        return self.get('forms/' + formId + '/variants', {
            fields: fields
        });
    }

    /**
     * @memberof GetResponse#
     * @namespace webForms
     */
    /**
     * @description gets list of web forms
     * @see {@link https://apidocs.getresponse.com/v3/resources/webforms#webforms.get.all}
     * @memberof GetResponse#
     * @method webForms#getWebForms
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of web form objects
     */
    methods.getWebForms = function (parameters) {
        return self.get('web-forms', parameters);
    }
    /**
     * @description gets info about one webform
     * @see {@link https://apidocs.getresponse.com/v3/resources/webforms#webforms.get}
     * @memberof GetResponse#
     * @method webForms#getWebForm
     * @param {string} webFormId web form's id obtained via {@link GetResponse#forms#getWebForms getWebForms} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @returns {object} web form object
     */
    methods.getWebForm = function (webFormId, fields) {
        return self.get('web-forms/' + webFormId, {
            fields: fields
        });
    }

    /**
     * @memberof GetResponse#
     * @namespace landingPages
     */
    /**
     * @description gets list of landing pages created in the account
     * @see {@link https://apidocs.getresponse.com/v3/resources/landing-pages#landing-pages.get.all}
     * @memberof GetResponse#
     * @method landingPages#getLandingPages
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} list of landing page objects
     */
    methods.getLandingPages = function (parameters) {
        return self.get('landing-pages', parameters);
    }
    /**
     * @description gets info about one landing page
     * @see {@link https://apidocs.getresponse.com/v3/resources/landing-pages#landing-pages.get}
     * @memberof GetResponse#
     * @method landingPages#getLandingPage
     * @param {string} landingPageId landing page's id obtained via {@link GetResponse#landingPages#getLandingPage getPage} method
     * @param {fields} fields list of fields that should be present in the returned object(s)
     * @returns {object} landing page object
     */
    methods.getLandingPage = function (landingPageId, fields) {
        return self.get('landing-page/' + landingPageId, {
            fields: fields
        });
    }

    /**
     * @memberof GetResponse#
     * @namespace imports
     */
    /**
     * @description gets list of contacts imports that have been performed or are in progress in the account
     * @see {@link https://apidocs.getresponse.com/v3/resources/imports#imports.get.all}
     * @memberof GetResponse#
     * @method imports#getImports
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of import objects
     */
    methods.getImports = function (parameters) {
        return self.get('imports', parameters);
    }
    /**
     * @description gets info about one import
     * @see {@link https://apidocs.getresponse.com/v3/resources/imports#imports.get}
     * @memberof GetResponse#
     * @method imports#getImport
     * @param {string} importId import's id obtained via {@link GetResponse#imports#getImports getImports} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @returns {object} import object
     */
    methods.getImport = function (importId, fields) {
        return self.get('imports/' + importId, {
            fields: fields
        });
    }

    /**
     * @memberof GetResponse#
     * @namespace suppressions
     */
    /**
     * @description gets list of suppression lists
     * @see {@link https://apidocs.getresponse.com/v3/resources/suppressions#suppressions.get.all}
     * @memberof GetResponse#
     * @method suppressions#getSuppressions
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} list of suppression list objects
     */
    methods.getSuppressions = function (parameters) {
        return self.get('suppressions', parameters);
    }
    /** need to test fields!!!
     * @description gets info about one suppression list
     * @see {@link https://apidocs.getresponse.com/v3/resources/suppressions#suppressions.get}
     * @memberof GetResponse#
     * @method suppressions#getSuppression
     * @param {string} suppressionId suppression list's id obtained via {@link GetResponse#suppressions#getSuppressions getSuppressions} method
     * @returns {object} suppression list object
     */
    methods.getSuppression = function (suppressionId) {
        return self.get('suppressions/' + suppressionId);
    }
    /**
     * @description creates a new suppression list
     * @see {@link https://apidocs.getresponse.com/v3/resources/suppressions#suppressions.create}
     * @memberof GetResponse#
     * @method suppressions#createSuppression
     * @param {string} name name of the new suppression list
     * @param {array} masks array of email masks to include in the suppression list
     * @returns {object} newly created suppression list object
     */
    methods.createSuppression = function (name, masks) {
        return self.post('suppressions', {
            name: name,
            masks: masks
        });
    }
    /**
     * @description updates a previously created suppression list
     * @see {@link https://apidocs.getresponse.com/v3/resources/suppressions#suppressions.update}
     * @memberof GetResponse#
     * @method suppressions#updateSuppression
     * @param {string} suppressionId suppression list's id obtained via {@link GetResponse#suppressions#getSuppressions getSuppressions} method
     * @param {string} name new name for the suppression list
     * @param {array} masks new array of masks to be used in the suppression list
     * @returns {object} updated suppression list object
     */
    methods.updateSuppression = function (suppressionId, name, masks) {
        return self.post('suppressions/' + suppressionId, {
            name: name,
            masks: masks
        })
    };
    /**
     * @description deletes a suppression list
     * @see {@link https://apidocs.getresponse.com/v3/resources/suppressions#suppressions.delete}
     * @memberof GetResponse#
     * @method suppressions#deleteSuppression
     * @param {string} suppressionId suppression list's id obtained via {@link GetResponse#suppressions#getSuppressions getSuppressions} method
     * @returns {number} status code
     */
    methods.deleteSuppression = function (suppressionId) {
        return self.remove('suppressions/' + suppressionId);
    }

    /**
     * @memberof GetResponse#
     * @namespace subscriptionConfirmations
     */
    /**
     * @description gets subscription confirmation messages' bodies for the given language
     * @see {@link https://apidocs.getresponse.com/v3/resources/subscription-confirmations#subscription-confirmations.body.get.all}
     * @memberof GetResponse#
     * @method subscriptionConfirmations#getSubscriptionConfirmationsBody
     * @param {string} languageCode 2-character language code
     * @returns {array} array of subscription confirmation body objects
     */
    methods.getSubscriptionConfirmationsBody = function (languageCode) {
        return self.get('subscription-confirmations/body/' + languageCode);
    }
    /**
     * @description gets subscription confirmation messages' subject lines for the given language
     * @see {@link https://apidocs.getresponse.com/v3/resources/subscription-confirmations#subscription-confirmations.subject.get.all}
     * @memberof GetResponse#
     * @method subscriptionConfirmations#getSubscriptionConfirmationsSubject
     * @param {string} languageCode 2-character language code
     * @returns {array} array of subscription confirmation subject objects
     */
    methods.getSubscriptionConfirmationsSubject = function (languageCode) {
        return self.get('subscription-confirmations/subject/' + languageCode);
    }

    /**
     * @memberof GetResponse#
     * @namespace crm
     */
    /**
     * @description gets CRM pipelines
     * @see {@link https://apidocs.getresponse.com/v3/resources/crm#crm.pipelines.get.all}
     * @memberof GetResponse#
     * @method crm#getPipelines
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of CRM pipeline objects
     */
    methods.getPipelines = function (parameters) {
        return self.get('pipelines', parameters);
    }
    /**
     * @description gets full info about one CRM pipeline
     * @see {@link https://apidocs.getresponse.com/v3/resources/crm#crm.pipelines.get}
     * @memberof GetResponse#
     * @method crm#getPipeline
     * @param {string} pipelineId CRM pipeline's id obtained via {@link GetResponse#crm#getPipelines getPipelines} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @returns {object} CRM pipeline object
     */
    methods.getPipeline = function (pipelineId, fields) {
        return self.get('pipelines/' + pipelineId, {
            fields: fields
        });
    }
    /**
     * @description gets list of stages in the selected CRM pipeline
     * @see {@link https://apidocs.getresponse.com/v3/resources/crm#crm.stages.get.all}
     * @memberof GetResponse#
     * @method crm#getPipelineStages
     * @param {string} pipelineId CRM pipeline's id obtained via {@link GetResponse#crm#getPipelines getPipelines} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @returns {array} array of CRM pipeline's stage objects
     */
    methods.getPipelineStages = function (pipelineId, fields) {
        return self.get('pipelines/' + pipelineId + '/stages', {
            fields: fields
        });
    }
    /**
     * @description gets full info about one CRM pipeline's stage
     * @see {@link https://apidocs.getresponse.com/v3/resources/crm#crm.stages.get}
     * @memberof GetResponse#
     * @method crm#getPipelineStage
     * @param {string} pipelineId CRM pipeline's id obtained via {@link GetResponse#crm#getPipelines getPipelines} method
     * @param {string} stageId CRM pipeline stage's id obtained via {@link GetResponse#crm#getPipelineStages getPipelineStages} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @returns {object} CRM pipeline stage object
     */
    methods.getPipelineStage = function (pipelineId, stageId, fields) {
        return self.get('pipelines/' + pipelineId + '/stages/' + stageId, {
            fields: fields
        });
    }

    /**
     * @memberof GetResponse#
     * @namespace automation
     */
    /**
     * @description gets list of automation workflows
     * @see {@link https://apidocs.getresponse.com/v3/resources/workflow#workflow.get.all}
     * @memberof GetResponse#
     * @method automation#getWorkflows
     * @param {number} page sets which page of query results to return
     * @param {number} perPage sets how many objects the returned array will contain (max: 1000)
     * @returns {array} array of automation workflow objects
     */
    methods.getAutomationWorklows = function (page, perPage) {
        return self.get('workflow', {
            perPage: perPage,
            page: page
        });
    }
    /**
     * @description gets full info about one automation workflow
     * @see {@link https://apidocs.getresponse.com/v3/resources/workflow#workflow.get}
     * @memberof GetResponse#
     * @method automtion#getWorkflow
     * @param {string} workflowId automation workflow's id obtained via {@link GetResponse#automation#getAutomationWorkflows getAutomationWorkflows} method
     * @returns {object} automation workflow object
     */
    methods.getAutomationWorkflow = function (workflowId) {
        return self.get('workflow/' + workflowId);
    }
    /**
     * @description updates workflow status to active or intactive
     * @see {@link https://apidocs.getresponse.com/v3/resources/workflow#workflow.create}
     * @memberof GetResponse#
     * @method automation#updateWorkflowStatus
     * @param {string} workflowId automation workflow's id obtained via {@link GetResponse#automation#getAutomationWorkflows getAutomationWorkflows} method
     * @param {string} status possible values: 'active', 'inactive'
     * @returns {object} information about automation workflow
     */
    methods.updateWorkflowStatus = function (workflowId, status) {
        return self.post('workflow/' + workflowId, {
            status: status
        });
    }

    /**
     * @memberof GetResponse#
     * @namespace accounts
     */
    /**
     * @description gets general info about GetResponse account
     * @see {@link https://apidocs.getresponse.com/v3/resources/accounts#accounts.get}
     * @memberof GetResponse#
     * @method accounts#getAccount
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @returns {object} account object
     */
    methods.getAccount = function (fields) {
        return self.get('accounts', {
            fields: fields
        });
    }
    /**
     * @description gets account billing details
     * @see {@link https://apidocs.getresponse.com/v3/resources/accounts#accounts.billing.get}
     * @memberof GetResponse#
     * @method accounts#getAccountBilling
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @returns {object} account billing details object
     */
    methods.getAccountBilling = function (fields) {
        return self.get('accounts/billing', {
            fields: fields
        });
    }
    /**
     * @description gets history of logins into the account
     * @see {@link https://apidocs.getresponse.com/v3/resources/accounts#accounts.loginhistory.get}
     * @memberof GetResponse#
     * @method accounts#getAccountLoginHistory
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @param {number} page sets which page of query results to return
     * @param {number} perPage sets how many objects the returned array will contain (max: 1000)
     * @returns {object} object whose "results" property will contain an array of object with details on logins into the account
     */
    methods.getAccountLoginHistory = function (fields, perPage, page) {
        return self.get('accounts/login-history', {
            fields: fields,
            perPage: perPage,
            page: page
        });
    }
    /**
     * @description gets the status of GetResponse badge in the account (enabled/disabled)
     * @see {@link https://apidocs.getresponse.com/v3/resources/accounts#accounts.badge.status.get}
     * @memberof GetResponse#
     * @method accounts#getAccountBadge
     * @returns {object} object with single "status" property
     */
    methods.getAccountBadge = function () {
        return self.get('accounts/badge');
    }
    /**
     * @description gets list of industry tags that can be assigned to account
     * @see {@link https://apidocs.getresponse.com/v3/resources/accounts#accounts.industry-tags.get}
     * @memberof GetResponse#
     * @method accounts#getAccountIndustries
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @returns {array} array of account industry objects
     */
    methods.getAccountIndustries = function (fields) {
        return self.get('accounts/industries', {
            fields: fields
        });
    }
    /**
     * @description gets list of timezones available to set in the account
     * @see {@link https://apidocs.getresponse.com/v3/resources/accounts#accounts.time-zones.get}
     * @memberof GetResponse#
     * @method accounts#getAccountTimeZones
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned
     * @returns {array} array of timezone objects
     */
    methods.getAccountTimeZones = function (fields) {
        return self.get('accounts/time-zones', {
            fields: fields
        });
    }
    /**
     * @description gets email masks added to account blacklist
     * @see {@link https://apidocs.getresponse.com/v3/resources/accounts#accounts.blacklists.get}
     * @memberof GetResponse#
     * @method accounts#getAccountBlacklist
     * @param {string} mask blacklist mask to search for
     * @returns {object} object whose only property "masks" will contain the list of email masks in the blacklist that satisfy given conditions
     */
    methods.getAccountBlacklist = function (mask) {
        return self.get('accounts/blacklists', {
            query: {
                mask: mask
            }
        });
    }
    /**
     * @description updates list of mask in the account blacklist, replacing them with new values
     * @see {@link https://apidocs.getresponse.com/v3/resources/accounts#accounts.blacklists.update}
     * @memberof GetResponse#
     * @method accounts#updateAccountBlacklist
     * @param {array} masks array of email masks to be blacklisted
     * @returns {object} updated account blacklist object
     */
    methods.updateAccountBlacklist = function (masks) {
        return self.post('accounts/blacklists', {
            masks: masks
        });
    }
    /**
     * @description updates account badge status
     * @see {@link https://apidocs.getresponse.com/v3/resources/accounts#accounts.badge.status.change}
     * @memberof GetResponse#
     * @method accounts#updateAccountBadgeStatus
     * @param {string} status account badge status: enabled or disabled
     * @returns {object} updated account badge status object
     */
    methods.updateAccountBadgeStatus = function (status) {
        return self.post('accounts/badge', {
            status: status
        });
    }
    /**
     * @description updates information about the account
     * @see {@link https://apidocs.getresponse.com/v3/resources/accounts#accounts.update}
     * @memberof GetResponse#
     * @method accounts#updateAccountInformation
     * @param {object} accountInformation object that contains account details to update
     * @returns {object} updated account details object
     */
    methods.updateAccountInformation = function (accountInformation) {
        return self.post('accounts', accountInformation);
    }

    /**
     * @memberof GetResponse#
     * @namespace savedSearches
     */
    /**
     * @description gets the list of saved searches
     * @see {@link https://apidocs.getresponse.com/v3/resources/search-contacts}
     * @memberof GetResponse#
     * @method savedSearches#getSavedSearches
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of saved search objects
     */
    methods.getSavedSearches = function (parameters) {
        return self.get('search-contacts', parameters);
    }
    /**
     * @description gets full info about one saved search
     * @see {@link https://apidocs.getresponse.com/v3/resources/search-contacts#search-contacts.get}
     * @memberof GetResponse#
     * @method savedSearches#getSavedSearch
     * @param {string} savedSearchId id of the saved search obtained via {@link GetResponse#savedSearches#getSavedSearches getSavedSearches} method
     * @returns {object} saved search object
     */
    methods.getSavedSearch = function (savedSearchId) {
        return self.get('search-contacts/' + savedSearchId);
    }
    /**
     * @description gets the list of contacts that satisfy conditions of the saved searches of the time of the request
     * @see {@link https://apidocs.getresponse.com/v3/resources/search-contacts#search-contacts.contacts.get.all}
     * @memberof GetResponse#
     * @method savedSearches#getSavedSearchContacts
     * @param {string} savedSearchId id of the saved search obtained via {@link GetResponse#savedSearches#getSavedSearches getSavedSearches} method 
     * @returns {array} list of contact objects
     */
    methods.getSavedSearchContacts = function (savedSearchId) {
        return self.get('search-contacts/' + savedSearchId + '/contacts');
    }
    /**
     * @description creates a new saved search
     * @see {@link https://apidocs.getresponse.com/v3/resources/search-contacts#search-contacts.create}
     * @memberof GetResponse#
     * @method savedSearches#createSavedSearch
     * @param {object} savedSearchConditions parameters of the saved search
     * @returns {object} newly saved search object
     */
    methods.createSavedSearch = function (savedSearchConditions) {
        return self.post('search-contacts', savedSearchConditions);
    }
    /**
     * @description updates a saved search
     * @see {@link https://apidocs.getresponse.com/v3/resources/search-contacts#search-contacts.update}
     * @memberof GetResponse#
     * @method savedSearches#updateSavedSearch
     * @param {string} savedSearchId id of the saved search obtained via {@link GetResponse#savedSearches#getSavedSearches getSavedSearches} method 
     * @param {object} savedSearchConditions new parameters of the saved search
     * @returns {object} updated saved search object
     */
    methods.updateSavedSearch = function (savedSearchId, savedSearchConditions) {
        return self.post('search-contacts/' + savedSearchId, savedSearchConditions);
    }
    /**
     * @description sets value(s) to custom field(s) for all contacts that satisfy conditions of the saved search at the moment of making the request
     * @see {@link https://apidocs.getresponse.com/v3/resources/search-contacts#search-contacts.custom-fields}
     * @memberof GetResponse#
     * @method savedSearches#setCustomFieldsToSavedSearch
     * @param {string} savedSearchId id of the saved search obtained via {@link GetResponse#savedSearches#getSavedSearches getSavedSearches} method 
     * @param {array} customFields array of custom fields and their values to assign to contacts
     */
    methods.setCustomFieldsToSavedSearch = function (savedSearchId, customFields) {
        return self.post('search-contacts/' + savedSearchId + '/custom-fields', {
            customFieldValues: customFields
        });
    }
    /**
     * @description gets list of contacts that satisfy given conditions without creating a new saved search
     * @see {@link https://apidocs.getresponse.com/v3/resources/search-contacts#search-contacts.contacts.form}
     * @memberof GetResponse#
     * @method savedSearches#searchContacts
     * @param {object} savedSearchConditions conditions to filter out the contact list
     * @returns {array} array of contacts that satisfy given conditions
     */
    methods.searchContacts = function (searchConditions) {
        return self.post('search-contacts/contacts', searchConditions);
    }
    /**
     * @description deletes a saved search
     * @see {@link https://apidocs.getresponse.com/v3/resources/search-contacts#search-contacts.delete}
     * @memberof GetResponse#
     * @method savedSearches#deleteSavedSearch
     * @param {string} savedSearchId id of the saved search obtained via {@link GetResponse#savedSearches#getSavedSearches getSavedSearches} method 
     */
    methods.deleteSavedSearch = function (savedSearchId) {
        return self.remove('search-contacts/' + savedSearchId);
    }

    /**
     * @memberof GetResponse#
     * @namespace ecommerce
     */

    /**
     * @memberof GetResponse#ecommerce
     * @namespace #shops
     */
    /**
     * @description gets list of shops
     * @see {@link https://apidocs.getresponse.com/v3/resources/shops-new#shops-new.get.all}
     * @memberof GetResponse#
     * @method ecommerce#shops#getShops
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of shop objects
     */
    methods.getShops = function (parameters) {
        return self.get('shops', parameters);
    }
    /**
     * @description gets info about one shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/shops-new#shops-new.get}
     * @memberof GetResponse#
     * @method ecommerce#shops#getShop
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {array|string} fields list of fields that should be present in the returned object(s)
     * @returns {object} shop object
     */
    methods.getShop = function (shopId, fields) {
        return self.get('shops/' + shopId, {
            fields: fields
        });
    }
    /**
     * @description creates a new shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/shops-new#shops-new.create}
     * @memberof GetResponse#
     * @method ecommerce#shops#createShop
     * @param {object} shop shop object
     * @returns {object} newly created object
     */
    methods.createShop = function (shop) {
        return self.post('shops', shop);
    }
    /**
     * @description updates an existing shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/shops-new#shops-new.update}
     * @memberof GetResponse#
     * @method ecommerce#shops#updateShop
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {object} shopSettings new shop settings
     * @returns {object} updated shop object
     */
    methods.updateShop = function (shopId, shopSettings) {
        return self.post('shops/' + shopId, shopSettings);
    }
    /**
     * @description deletes a shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/shops-new#shops-new.delete}
     * @memberof GetResponse#
     * @method ecommerce#shops#deleteShop
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     */
    methods.deleteShop = function (shopId) {
        return self.remove('shops/' + shopId);
    }

    /**
     * @memberof GetResponse#
     * @namespace ecommerce#categories
     */
    /**
     * @description get list of product categories that belong to the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/categories#categories.get.all}
     * @memberof GetResponse#
     * @method ecommerce#categories#getCategories
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of category objects
     */
    methods.getCategories = function (shopId, parameters) {
        return self.get('shops/' + shopId + '/categories', parameters);
    }
    /**
     * @description gets full info about one product category in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/categories#categories.get}
     * @memberof GetResponse#
     * @method ecommerce#categories#getCategory
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} categoryId category's id obtained via {@link GetResponse#ecommerce#getCategories getCategories} method
     * @param {array|string} fields list of fields that should be present in the returned object(s)
     * @returns {object} category object
     */
    methods.getCategory = function (shopId, categoryId, fields) {
        return self.get('shops/' + shopId + '/categories', {
            fields: fields
        });
    }
    /**
     * @description creates a new product category in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/categories#categories.create}
     * @memberof GetResponse#
     * @method ecommerce#categories#createCategory
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {object} category category object
     * @returns {object} newly created category object
     */
    methods.createCategory = function (shopId, category) {
        return self.post('shops/' + shopId + '/categories', category);
    }
    /**
     * @description updates an existing product category in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/categories#categories.update}
     * @memberof GetResponse#
     * @method ecommerce#categories#updateCategory
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} categoryId category's id obtained via {@link GetResponse#ecommerce#getCategories getCategories} method
     * @param {object} category new category object
     * @returns {object} updated category object
     */
    methods.updateCategory = function (shopId, categoryId, category) {
        return self.post('shops/' + shopId + '/categories/' + categoryId, category);
    }
    /**
     * @description deletes a product category in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/categories#categories.delete}
     * @memberof GetResponse#
     * @method ecommerce#categories#deleteCategory
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} categoryId category's id obtained via {@link GetResponse#ecommerce#getCategories getCategories} method
     */
    methods.deleteCategory = function (shopId, categoryId) {
        return self.remove('shops/' + shopId + '/categories/' + categoryId);
    }

    /**
     * @memberof GetResponse#
     * @namespace ecommerce#addresses
     */
    /**
     * @description gets list of addresses
     * @see {@link https://apidocs.getresponse.com/v3/resources/addresses#addresses.get.all}
     * @memberof GetResponse#
     * @method ecommerce#addresses#getAddresses
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} list of address objects
     */
    methods.getAddresses = function (parameters) {
        return self.get('addresses', parameters);
    }
    /**
     * @description gets full info about one address
     * @see {@link https://apidocs.getresponse.com/v3/resources/addresses#addresses.get}
     * @memberof GetResponse#
     * @method ecommerce#addresses#getAddress
     * @param {string} addressId address's id obtained via {@link GetResponse#addresses#getAddresses getAddresses} method
     * @param {array|string} fields list of fields that should be present in the returned object(s)
     * @returns {object} address object
     */
    methods.getAddress = function (addressId, fields) {
        return self.get('addresses/' + addressId, {
            fields: fields
        });
    }
    /**
     * @description creates a new address
     * @see {@link https://apidocs.getresponse.com/v3/resources/addresses#addresses.create}
     * @memberof GetResponse#
     * @method ecommerce#addresses#createAddress
     * @param {object} address address object
     * @returns {object} newly created address object
     */
    methods.createAddress = function (address) {
        return self.post('addresses', address);
    }
    /**
     * @description updates an existing address
     * @see {@link https://apidocs.getresponse.com/v3/resources/addresses#addresses.update}
     * @memberof GetResponse#
     * @method ecommerce#addresses#updateAddress
     * @param {string} addressId address's id obtained via {@link GetResponse#addresses#getAddresses getAddresses} method
     * @param {object} address address object
     * @returns {object} updated address object
     */
    methods.updateAddress = function (addressId, address) {
        return self.post('addresses/' + addressId, address);
    }
    /**
     * @description deletes an address
     * @see {@link https://apidocs.getresponse.com/v3/resources/addresses#addresses.delete}
     * @memberof GetResponse#
     * @method ecommerce#addresses#deleteAddress
     * @param {string} addressId address's id obtained via {@link GetResponse#addresses#getAddresses getAddresses} method
     */
    methods.deleteAddress = function (addressId) {
        return self.remove('addresses/' + addressId);
    }

    /**
     * @memberof GetResponse#
     * @namespace ecommerce#orders
     */
    /**
     * @description gets list of orders made in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/orders#orders..get.all}
     * @memberof GetResponse#
     * @method ecommerce#orders#getOrders
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of order objects
     */
    methods.getOrders = function (shopId, parameters) {
        return self.get('shops/' + shopId + '/orders', parameters);
    }
    /**
     * @description gets full info about one order
     * @see {@link https://apidocs.getresponse.com/v3/resources/orders#orders..get}
     * @memberof GetResponse#
     * @method ecommerce#orders#getOrder
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} orderId order's id obtained via {@link GetResponse#ecommerce#orders#getOrders getOrders} method
     * @param {array|string} fields list of fields that should be present in the returned object(s)
     * @returns {object} order object
     */
    methods.getOrder = function (shopId, orderId, fields) {
        return self.get('shops/' + shopId + '/orders/' + orderId, {
            fields: fields
        });
    }
    /**
     * @description creates a new order in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/orders#orders.#orders.create}
     * @memberof GetResponse#
     * @method ecommerce#orders#createOrder
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {object} order order object
     * @param {string} additionalFlags additional flags parameter with value 'skipAutomation' will skip the triggering automation's 'Make a purchase' element.
     * @returns {object} order object
     */
    methods.createOrder = function (shopId, order, additionalFlags) {
        var url = 'shops/' + shopId + '/orders/';
        if (additionalFlags) url += '?additionalFlags=' + additionalFlags;
        return self.post(url, order);
    }
    /**
     * @description updates an existing order in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/orders#orders..update}
     * @memberof GetResponse#
     * @method ecommerce#orders#updateOrder
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} orderId order's id obtained via {@link GetResponse#ecommerce#orders#getOrders getOrders} method
     * @param {object} order order object
     * @param {string} additionalFlags additional flags parameter with value 'skipAutomation' will skip the triggering automation's 'Make a purchase' element.
     * @returns {object} updated order object
     */
    methods.updateOrder = function (shopId, orderId, order, additionalFlags) {
        var url = 'shops/' + shopId + '/orders/' + orderId;
        if (additionalFlags) url += '?additionalFlags=' + additionalFlags;
        return self.post(url, order);
    }
    /**
     * @description deletes an order in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/orders#orders..delete}
     * @memberof GetResponse#
     * @method ecommerce#orders#deleteOrder
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} orderId order's id obtained via {@link GetResponse#ecommerce#orders#getOrders getOrders} method
     */
    methods.deleteOrder = function (shopId, orderId) {
        return self.remove('shops/' + shopId + '/orders/' + orderId);
    }

    /**
     * @memberof GetResponse#
     * @namespace ecommerce#carts
     */
    /**
     * @description gets list of abandoned carts in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/carts#carts.get.all}
     * @memberof GetResponse#
     * @method ecommerce#carts#getCarts
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} list of cart objects
     */
    methods.getCarts = function (shopId, parameters) {
        return self.get('shops/' + shopId + '/carts', parameters);
    }
    /**
     * @description gets full info about one abandoned cart
     * @see {@link https://apidocs.getresponse.com/v3/resources/carts#carts.get}
     * @memberof GetResponse#
     * @method ecommerce#carts#getCart
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} cartId cart's id obtained via {@link GetResponse#ecommerce#carts#getCarts getCarts} method
     * @param {array|string} fields list of fields that should be present in the returned object(s)
     * @returns {object} cart object
     */
    methods.getCart = function (shopId, cartId, fields) {
        return self.get('shops/' + shopId + '/carts/' + cartId, {
            fields: fields
        });
    }
    /**
     * @description creates a new abandoned cart in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/carts#carts.create}
     * @memberof GetResponse#
     * @method ecommerce#carts#createCart
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {object} cart cart object
     * @returns {object} newly created cart object
     */
    methods.createCart = function (shopId, cart) {
        return self.post('shops/' + shopId + '/carts', cart);
    }
    /**
     * @description updates an abandoned cart object in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/carts#carts.update}
     * @memberof GetResponse#
     * @method ecommerce#carts#updateCart
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} cartId cart's id obtained via {@link GetResponse#ecommerce#carts#getCarts getCarts} method
     * @param {object} cart cart object
     * @returns {object} updated cart object
     */
    methods.updateCart = function (shopId, cartId, cart) {
        return self.post('shops/' + shopId + '/carts/' + cartId, cart);
    }
    /**
     * @description deletes an abandoned cart in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/carts#carts.delete}
     * @memberof GetResponse#
     * @method ecommerce#carts#deleteCart
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} cartId cart's id obtained via {@link GetResponse#ecommerce#carts#getCarts getCarts} method
     */
    methods.deleteCart = function (shopId, cartId) {
        return self.remove('shops/' + shopId + '/carts/' + cartId);
    }

    /**
     * @memberof GetResponse#
     * @namespace ecommerce#metaFields
     */
    /**
     * @description gets the list of meta fields of the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/metafields#metafields.get.all}
     * @memberof GetResponse#
     * @method ecommerce#metaFields#getMetaFields
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of meta field objects
     */
    methods.getMetaFields = function (shopId, parameters) {
        return self.get('shops/' + shopId + '/meta-fields', parameters);
    }
    /**
     * @description gets full info about one meta field in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/metafields#metafields.get}
     * @memberof GetResponse#
     * @method ecommerce#metaFields#getMetaField
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} metaFieldId meta field's id obtained via {@link GetResponse#ecommerce#metaFields#getMetaFields getMetaFields} method
     * @param {array|string} fields list of fields that should be present in the returned object(s)
     * @returns {object} meta field object
     */
    methods.getMetaField = function (shopId, metaFieldId, fields) {
        return self.get('shops/' + shopId + '/meta-fields/' + metaFieldId, {
            fields: fields
        });
    }
    /**
     * @description creates a new meta field in the given shop object
     * @see {@link https://apidocs.getresponse.com/v3/resources/metafields#metafields.create}
     * @memberof GetResponse#
     * @method ecommerce#metaFields#createMetaField
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {object} metaField meta field object
     * @returns {object} newly created meta field object
     */
    methods.createMetaField = function (shopId, metaField) {
        return self.post('shops/' + shopId + '/meta-fields', metaField);
    }
    /**
     * @description updates an existing meta field object in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/metafields#metafields.update}
     * @memberof GetResponse#
     * @method ecommerce#metaFields#updateMetaField
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} metaFieldId meta field's id obtained via {@link GetResponse#ecommerce#metaFields#getMetaFields getMetaFields} method
     * @param {object} metaField meta field object
     * @returns {object} updated meta field object
     */
    methods.updateMetaField = function (shopId, metaFieldId, metaField) {
        return self.post('shops/' + shopId + '/meta-fields/' + metaFieldId, metaField);
    }
    /**
     * @description deletes a meta field in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/metafields#metafields.delete}
     * @memberof GetResponse#
     * @method ecommerce#metaFields#deleteMetaField
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} metaFieldId meta field's id obtained via {@link GetResponse#ecommerce#metaFields#getMetaFields getMetaFields} method
     */
    methods.deleteMetaField = function (shopId, metaFieldId) {
        return self.remove('shops/' + shopId + '/meta-fields/' + metaFieldId);
    }

    /**
     * @memberof GetResponse#
     * @namespace ecommerce#products
     */
    /**
     * @description gets list of products in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/products#products.get.all}
     * @memberof GetResponse#
     * @method ecommerce#products#getProducts
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of product objects
     */
    methods.getProducts = function (shopId, parameters) {
        return self.get('shops/' + shopId + '/products', parameters);
    }
    /**
     * @description gets full info about one product in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/products#products.get}
     * @memberof GetResponse#
     * @method ecommerce#products#getProduct
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} productId product's id obtained via {@link GetResponse#ecommerce#products#getProducts getProducts} method
     * @param {array|string} fields list of fields that should be present in the returned object(s)
     * @returns {object} product object
     */
    methods.getProduct = function (shopId, productId, fields) {
        return self.get('shops/' + shopId + '/products/' + productId, {
            fields: fields
        });
    }
    /**
     * @description creates a new product in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/products#products.create}
     * @memberof GetResponse#
     * @method ecommerce#products#createProduct
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {object} product product object
     * @returns {object} newly created product object
     */
    methods.createProduct = function (shopId, product) {
        return self.post('shops/' + shopId + '/products', product);
    }
    /**
     * @description updates an existing product in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/products#products.update}
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} productId product's id obtained via {@link GetResponse#ecommerce#products#getProducts getProducts} method
     * @param {object} product product object
     * @returns {object} updated product object
     */
    methods.updateProduct = function (shopId, productId, product) {
        return self.post('shops/' + shopId + '/products/' + productId, product);
    }
    /**
     * @description updates categories of the given product
     * @see {@link https://apidocs.getresponse.com/v3/resources/products#products.categories.upsert}
     * @memberof GetResponse#
     * @method ecommerce#products#updateProductCategories
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} productId product's id obtained via {@link GetResponse#ecommerce#products#getProducts getProducts} method
     * @param {array} categories array of category objects
     * @returns {array} array of the product's category objects
     */
    methods.updateProductCategories = function (shopId, productId, categories) {
        return self.post('shops/' + shopId + '/products/' + productId, {
            categories: categories
        });
    }
    /**
     * @description updates product meta fields
     * @see {@link https://apidocs.getresponse.com/v3/resources/products#products.meta-fields.upsert}
     * @memberof GetResponse#
     * @method ecommerce#products#updateProductMetaFields
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} productId product's id obtained via {@link GetResponse#ecommerce#products#getProducts getProducts} method
     * @param {array} metaFields array of meta field objects
     * @returns {array} array of the product's meta field object
     */
    methods.updateProductMetaFields = function (shopId, productId, metaFields) {
        return self.post('shops/' + shopId + '/products/' + productId, {
            metaFields: metaFields
        });
    }
    /**
     * @description deletes a product from the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/products#products.delete}
     * @memberof GetResponse#
     * @method ecommerce#products#deleteProduct
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} productId product's id obtained via {@link GetResponse#ecommerce#products#getProducts getProducts} method
     */
    methods.deleteProduct = function (shopId, productId) {
        return self.remove('shops/' + shopId + '/products/' + productId);
    }

    /**
     * @memberof GetResponse#
     * @namespace ecommerce#productVariants
     */
    /**
     * @description gets product variants
     * @see {@link https://apidocs.getresponse.com/v3/resources/product-variants#product-variants.get.all}
     * @memberof GetResponse#
     * @method ecommerce#productVariants#getProductVariants
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} productId product's id obtained via {@link GetResponse#ecommerce#products#getProducts getProducts} method
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of product variant objects
     */
    methods.getProductVariants = function (shopId, productId, parameters) {
        return self.get('shops/' + shopId + '/products/' + productId + '/variants', parameters);
    }
    /**
     * @description gets full info about one product variant
     * @see {@link https://apidocs.getresponse.com/v3/resources/product-variants#product-variants.get}
     * @memberof GetResponse#
     * @method ecommerce#productVariants#getProductVariant
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} productId product's id obtained via {@link GetResponse#ecommerce#products#getProducts getProducts} method
     * @param {string} variantId product variant's id obtained via {@link GetResponse#ecommerce#productVariants#getProductVariants getProductVariants} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned.
     * @returns {object} product variant object
     */
    methods.getProductVariant = function (shopId, productId, variantId, fields) {
        return self.get('shops/' + shopId + '/products/' + productId + '/variants/' + variantId, {
            fields: fields
        });
    }
    /**
     * @description creates a new product variant
     * @see {@link https://apidocs.getresponse.com/v3/resources/product-variants#product-variants.create}
     * @memberof GetResponse#
     * @method ecommerce#productVariants#createProductVariant
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} productId product's id obtained via {@link GetResponse#ecommerce#products#getProducts getProducts} method
     * @param {object} variant variant object
     * @returns {object} newly created variant object
     */
    methods.createProductVariant = function (shopId, productId, variant) {
        return self.post('shops/' + shopId + '/products/' + productId + '/variants', variant);
    }
    /**
     * @description updates an existing product variant
     * @see {@link https://apidocs.getresponse.com/v3/resources/product-variants#product-variants.update}
     * @memberof GetResponse#
     * @method ecommerce#productVariants#updateProductVariant
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} productId product's id obtained via {@link GetResponse#ecommerce#products#getProducts getProducts} method
     * @param {string} variantId product variant's id obtained via {@link GetResponse#ecommerce#productVariants#getProductVariants getProductVariants} method
     * @param {object} variant product variant object
     * @returns {object} updated product variant object
     */
    methods.updateProductVariant = function (shopId, productId, variantId, variant) {
        return self.post('shops/' + shopId + '/products/' + productId + '/variants/' + variantId, variant);
    }
    /**
     * @description deletes a product variant
     * @see {@link https://apidocs.getresponse.com/v3/resources/product-variants#product-variants.delete}
     * @memberof GetResponse#
     * @method ecommerce#productVariants#deleteProductVariant
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} productId product's id obtained via {@link GetResponse#ecommerce#products#getProducts getProducts} method
     * @param {string} variantId product variant's id obtained via {@link GetResponse#ecommerce#productVariants#getProductVariants getProductVariants} method
     */
    methods.deleteProductVariant = function (shopId, productId, variantId) {
        return self.remove('shops/' + shopId + '/products/' + productId + '/variants/' + variantId);
    }

    /**
     * @memberof GetResponse#
     * @namespace ecommerce#taxes
     */
    /**
     * @description gets taxes of the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/taxes#taxes.get.all}
     * @memberof GetResponse#
     * @method ecommerce#taxes#getTaxes
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {object|string} parameters query parameters set as object or query string
     * @returns {array} array of tax objects
     */
    methods.getTaxes = function (shopId, parameters) {
        return self.get('shops/' + shopId + '/taxes', parameters);
    }
    /**
     * @description gets one tax object
     * @see {@link https://apidocs.getresponse.com/v3/resources/taxes#taxes.get}
     * @memberof GetResponse#
     * @method ecommerce#taxes#getTax
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} taxId tax's id obtained via {@link GetResponse#ecommerce#taxes#getTaxes getTaxes} method
     * @param {array|string} fields list of fields that should be present in the returned object(s). Id is always returned.
     * @returns {object} tax object
     */
    methods.getTax = function (shopId, taxId, fields) {
        return self.get('shops/' + shopId + '/taxes/' + taxId, {
            fields: fields
        });
    }
    /**
     * @description creates a new tax in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/taxes#taxes.create}
     * @memberof GetResponse#
     * @method ecommerce#taxes#createTax
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {object} tax tax object
     * @returns {object} newly created tax object
     */
    methods.createTax = function (shopId, tax) {
        return self.post('shops/' + shopId + '/taxes', tax);
    }
    /**
     * @description updates an existing tax in the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/taxes#taxes.update}
     * @memberof GetResponse#
     * @method ecommerce#taxes#updateTax
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} taxId tax's id obtained via {@link GetResponse#ecommerce#taxes#getTaxes getTaxes} method
     * @param {object} tax tax object
     * @returns {object} updated tax object
     */
    methods.updateTax = function (shopId, taxId, tax) {
        return self.post('shops/' + shopId + '/taxes/' + taxId, tax);
    }
    /**
     * @description deletes a tax from the given shop
     * @see {@link https://apidocs.getresponse.com/v3/resources/taxes#taxes.delete}
     * @memberof GetResponse#
     * @method ecommerce#taxes#deleteTax
     * @param {string} shopId shop's id obtained via {@link GetResponse#ecommerce#shops#getShops getShops} method
     * @param {string} taxId tax's id obtained via {@link GetResponse#ecommerce#taxes#getTaxes getTaxes} method
     */
    methods.deleteTax = function (shopId, taxId) {
        return self.remove('shops/' + shopId + '/taxes/' + taxId);
    }

    /**
     * @memberof GetResponse#
     * @namespace multimedia
     */
    /**
     * @description gets info about files uploaded into GetResponse account
     * @see {@link}
     * @memberof GetResponse#
     * @method multimedia#getFiles
     * @param {number} page sets which page of query results to return
     * @param {number} perPage sets how many objects the returned array will contain (max: 1000)
     * @returns {array} list of object with information about multimedia files
     */
    methods.getFiles = function (page, perPage) {
        return self.get('multimedia', {
            perPage: perPage,
            page: page
        });
    }
    /**
     * @description uploads an image into GetResponse
     * @see {@link https://apidocs.getresponse.com/v3/resources/multimedia#multimedia.create}
     * @memberof GetResponse#
     * @method multimedia#uploadFile
     * @param {blob} blob blob object of the file to upload
     * @returns {object} info about the uploaded file
     */
    methods.uploadFile = function (blob) {
        return self.upload(blob);
    }
    methods.checkEnvironment = checkEnvironment;
    return methods;
}
