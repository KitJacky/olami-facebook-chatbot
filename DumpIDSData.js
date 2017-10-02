function DumpIDSData() {

}

DumpIDSData.prototype.getCookingResult = function(serverResponse) {
	var json = JSON.parse(serverResponse);
	var cooking = new Array(2);

	cooking[1] = json['data']['nli'][0]['data_obj'][0]['name'];
	cooking[2] = json['data']['nli'][0]['data_obj'][0]['content'];

	return cooking;
}

DumpIDSData.prototype.geWikiResult = function(serverResponse) {
	var json = JSON.parse(serverResponse);
	var baike = new Array(2);

	baike[1] = json['data']['nli'][0]['data_obj'][0]['field_name'];
	baike[2] = json['data']['nli'][0]['data_obj'][0]['field_value'];
	baike[3] = json['data']['nli'][0]['data_obj'][0]['description'];
	baike[4] = json['data']['nli'][0]['data_obj'][0]['photo_url'];

	return baike;
}

DumpIDSData.prototype.geJokeResult = function(serverResponse) {
	var json = JSON.parse(serverResponse);
	var joke = new Array(2);

	joke[1] = json['data']['nli'][0]['data_obj'][0]['content'];

	return joke;
}

DumpIDSData.prototype.gePoemResult = function(serverResponse) {
	var json = JSON.parse(serverResponse);
	var poem = new Array(2);

	poem[1] = json['data']['nli'][0]['data_obj'][0]['author'];
	poem[2] = json['data']['nli'][0]['data_obj'][0]['title'];
	poem[3] = json['data']['nli'][0]['data_obj'][0]['content'];

	return poem;
}

module.exports = DumpIDSData;
