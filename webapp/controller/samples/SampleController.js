sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/odata/v2/ODataModel"
], function (Controller, ODataModel) {
    "use strict";
    return Controller.extend("my.namespace.controller.MyController", {
        onInit: function () {
            var oModel = this.getView().getModel(); // 현재 뷰에 설정된 ODataModel 가져오기

            // 메타데이터가 로드된 후에만 메타데이터를 확인하는 로직 실행
            oModel.metadataLoaded().then(function () {
                var oMetaModel = oModel.getServiceMetadata(); // 메타데이터 객체 가져오기
                var sEntitySetName = "Orders"; // 바인딩하려는 엔터티셋 이름 설정
                var aExpandProps = this._getExpandProperties(oMetaModel, sEntitySetName); // 연관 관계가 있는 속성 이름 배열 가져오기

                // 확장할 속성이 있는 경우와 없는 경우에 따라 다른 바인딩 설정
                if (aExpandProps.length > 0) {
                    this._bindTableWithExpand(aExpandProps); // 확장 속성이 있으면 확장 포함하여 바인딩
                } else {
                    this._bindTableWithoutExpand(); // 확장 속성이 없으면 일반 바인딩
                }
            }.bind(this));
        },

        // 메타데이터에서 특정 EntitySet이 가지고 있는 확장 가능한 속성(NavigationProperty) 이름 배열을 반환하는 함수
        _getExpandProperties: function (oMetaModel, sEntitySetName) {
            var aExpandProps = []; // 확장할 속성 이름을 저장할 배열
            var oEntitySet = oMetaModel.dataServices.schema[0].entityContainer[0].entitySet; // 메타데이터에서 모든 EntitySet 정보 가져오기
            var oEntityType = null; // EntitySet의 EntityType을 저장할 변수

            // entitySet에서 해당 이름과 일치하는 EntitySet의 EntityType 가져오기
            for (var i = 0; i < oEntitySet.length; i++) {
                if (oEntitySet[i].name === sEntitySetName) {
                    oEntityType = oEntitySet[i].entityType; // 일치하는 경우 EntityType 저장
                    break;
                }
            }

            if (oEntityType) { // EntityType이 확인된 경우
                // 메타데이터에서 해당 EntityType의 정의를 찾기 위해 schema와 entityType 정보를 가져옴
                var oSchema = oMetaModel.dataServices.schema[0]; 
                var aEntityTypes = oSchema.entityType;

                // EntityType 이름이 일치하는 항목 찾기 (Namespace를 제외한 EntityType 이름 비교)
                var oCurrentEntityType = aEntityTypes.find(function (entityType) {
                    return entityType.name === oEntityType.split(".")[1]; // 'Namespace.EntityType' 형식에서 EntityType만 분리하여 비교
                });

                // EntityType에 NavigationProperty가 있는 경우 확장 가능한 속성 이름을 배열에 추가
                if (oCurrentEntityType && oCurrentEntityType.navigationProperty) {
                    oCurrentEntityType.navigationProperty.forEach(function (navProp) {
                        aExpandProps.push(navProp.name); // NavigationProperty 이름 추가
                    });
                }
            }

            return aExpandProps; // 확장 가능한 속성 이름 배열 반환
        },

        // 테이블에 확장 가능한 속성이 있을 경우 $expand 옵션을 설정하여 바인딩하는 함수
        _bindTableWithExpand: function (aExpandProps) {
            var oTable = this.byId("orderTable"); // 테이블 객체 가져오기
            var sExpandString = aExpandProps.join(","); // 확장할 속성들을 콤마(,)로 연결하여 문자열로 변환

            // 테이블에 $expand 파라미터를 설정하여 바인딩
            oTable.bindItems({
                path: "/Orders", // 엔티티셋 경로
                parameters: {
                    expand: sExpandString // 확장할 속성들 설정
                },
                template: oTable.getBindingInfo("items").template // 기존 바인딩 템플릿 유지
            });
        },

        // 확장 가능한 속성이 없을 경우 일반 바인딩으로 테이블을 바인딩하는 함수
        _bindTableWithoutExpand: function () {
            var oTable = this.byId("orderTable"); // 테이블 객체 가져오기

            // 확장 없이 기본 바인딩 설정
            oTable.bindItems({
                path: "/Orders", // 엔티티셋 경로
                template: oTable.getBindingInfo("items").template // 기존 바인딩 템플릿 유지
            });
        }
    });
});
