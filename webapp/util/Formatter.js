sap.ui.define([
"sap/ui/core/format/DateFormat"
], function(DateFormat) {
	"use strict";

	// 전역 포맷 패턴 정의 (요일 포함)
	const DATE_FORMAT_PATTERN = "yyyy-MM-dd (EEE)";

	return {
		// ISO 8601 형식을 yyyy-MM-dd (EEE) 형식으로 변환하는 함수
		formatDate: function(isoDateString) {
			if (isoDateString) {
				// ISO 8601 형식을 Date 객체로 변환
				var dateObject = new Date(isoDateString);

				// Date 객체를 전역 포맷 패턴으로 변환
				return this.formatter.formatDateFromDataObject(dateObject, DATE_FORMAT_PATTERN);
			}
			return null;
		},

		formatDateFromDataObject: function(dateObject, dateFormatPattern) {
			if (dateObject) {
				// Date 객체를 지정된 패턴으로 변환
				var oDateFormat = DateFormat.getDateTimeInstance({ pattern: dateFormatPattern });
				return oDateFormat.format(dateObject);
			}
			return null;
		},

		// yyyy-MM-dd (EEE) 형식을 ISO 8601 형식으로 변환하는 함수
		parseDate: function(dateString) {
			if (dateString) {
				var oDateFormat = DateFormat.getDateTimeInstance({ pattern: DATE_FORMAT_PATTERN });
				var dateObject = oDateFormat.parse(dateString);
				if (dateObject) {
					// ISO 8601 형식으로 변환
					return dateObject.toISOString();
				}
			}
			return null;
		},

		// 다른 곳에서 사용하기 위해 포맷 패턴을 제공하는 함수
		getDateFormatPattern: function() {
			return DATE_FORMAT_PATTERN;
		}
	};
});
