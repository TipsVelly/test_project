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
        },

        loadCombinedDataV2: async function(...aOptions) {
            try {
                // 각 모델의 Service URL을 추출하여 배열에 저장
                const aServiceUrls = aOptions.map(({ oModel }) => oModel.sServiceUrl);
                // 첫 번째 모델의 Service URL을 메인 URL로 설정
                const sMainServiceUrl = aServiceUrls[0];
        
                // 확장할 엔티티셋 이름들을 저장할 배열
                let aExpandEntities = [];
        
                // 강제 조인 조건을 저장할 배열
                let aJoinConditions = [];
        
                // 첫 번째 모델 옵션을 메인 옵션으로 설정
                const oMainOption = aOptions[0];
        
                // 메인 서비스 URL과 나머지 서비스 URL 비교
                for (let i = 1; i < aServiceUrls.length; i++) {
                    const sServiceUrl = aServiceUrls[i];
                    const oCurrentOption = aOptions[i];
        
                    if (sServiceUrl === sMainServiceUrl) {
                        // 메인 서비스 URL과 같을 경우 외래키 여부 체크
                        const isForeignKeyRelated = this._checkForeignKeyRelationship(
                            oMainOption.oModel,       // 메인 모델
                            oMainOption.sEntitySet,   // 메인 엔티티셋 이름
                            oCurrentOption.sEntitySet // 현재 비교하는 엔티티셋 이름
                        );
        
                        if (isForeignKeyRelated) {
                            // 외래키 관계가 있을 경우, 확장할 엔티티셋 이름 추가
                            aExpandEntities.push(oCurrentOption.sEntitySet);
                            console.log(`Foreign key relation found. Adding ${oCurrentOption.sEntitySet} to expand list.`);
                        } else {
                            // 외래키 관계가 없으면 강제 조인 조건으로 `joinProperty`를 사용
                            aJoinConditions.push({
                                mainEntitySet: oMainOption.sEntitySet,       // 메인 엔티티셋 이름
                                joinEntitySet: oCurrentOption.sEntitySet,    // 조인할 엔티티셋 이름
                                mainJoinProperty: oMainOption.joinProperty,  // 메인 조인 프로퍼티
                                joinJoinProperty: oCurrentOption.joinProperty // 조인할 조인 프로퍼티
                            });
                        }
                    } else {
                        // 메인 서비스 URL과 다를 경우에도 강제 조인 조건으로 `joinProperty` 사용
                        aJoinConditions.push({
                            mainEntitySet: oMainOption.sEntitySet,       // 메인 엔티티셋 이름
                            joinEntitySet: oCurrentOption.sEntitySet,    // 조인할 엔티티셋 이름
                            mainJoinProperty: oMainOption.joinProperty,  // 메인 조인 프로퍼티
                            joinJoinProperty: oCurrentOption.joinProperty // 조인할 조인 프로퍼티
                        });
                    }
                }
        
                if (aExpandEntities.length > 0) {
                    // $expand를 위한 쿼리 문자열을 생성
                    const sExpandQuery = aExpandEntities.join(',');
        
                    console.log(`Fetching data with $expand: ${sExpandQuery}`);
        
                    // 메인 모델에서 $expand를 사용하여 데이터 읽기
                    oMainOption.oModel.read(`/${oMainOption.sEntitySet}`, {
                        urlParameters: {
                            "$expand": sExpandQuery // 동적으로 생성된 $expand 쿼리 설정
                        },
                        success: (oData) => {
                            // 데이터 결합 후 모델에 바인딩
                            this._bindCombinedModel(oData);
                        },
                        error: (oError) => {
                            console.error("Error fetching data with $expand:", oError);
                        }
                    });
                }
        
                if (aJoinConditions.length > 0) {
                    // 강제 조인 조건에 따라 데이터를 가져와 조인
                    for (const condition of aJoinConditions) {
                        this._performForcedJoin(oMainOption, condition);
                    }
                }
        
            } catch (error) {
                console.error("Error loading combined data:", error);
            }
        },
        
        // 외래키 관계 여부를 체크하는 함수
        _checkForeignKeyRelationship: function(oModel, sEntitySetName1, sEntitySetName2) {
            const oMetadata = oModel.getServiceMetadata(); // 모델의 메타데이터를 가져옴
            const oEntitySet1 = this._getEntitySetProperties(oMetadata, sEntitySetName1); // 첫 번째 엔티티셋 정보 추출
            const oEntitySet2 = this._getEntitySetProperties(oMetadata, sEntitySetName2); // 두 번째 엔티티셋 정보 추출
        
            // 첫 번째 엔티티셋의 모든 속성 이름을 배열로 추출
            const aEntitySet1Properties = oEntitySet1.properties.map(prop => prop.name);
            // 두 번째 엔티티셋의 모든 속성 이름을 배열로 추출
            const aEntitySet2Properties = oEntitySet2.properties.map(prop => prop.name);
        
            // 첫 번째 엔티티셋의 속성 중 두 번째 엔티티셋에 존재하는 속성이 있는지 확인
            return aEntitySet1Properties.some(prop => aEntitySet2Properties.includes(prop));
        },
        
        // 강제 조인 조건을 받아 데이터를 결합하는 함수
        _performForcedJoin: function(oMainOption, joinCondition) {
            // 메인 모델의 데이터를 읽어옴
            oMainOption.oModel.read(`/${joinCondition.mainEntitySet}`, {
                success: (oData1) => {
                    // 조인할 모델의 데이터를 읽어옴
                    oMainOption.oModel.read(`/${joinCondition.joinEntitySet}`, {
                        success: (oData2) => {
                            // 두 데이터셋을 joinProperty 기준으로 결합
                            const oJoinedData = this._joinData(
                                oData1.results, oData2.results,
                                joinCondition.mainJoinProperty, joinCondition.joinJoinProperty
                            );
        
                            // 결합된 데이터 바인딩
                            this._bindCombinedModel({ data: oJoinedData });
                        },
                        error: (oError) => {
                            console.error(`Error fetching data from ${joinCondition.joinEntitySet}:`, oError);
                        }
                    });
                },
                error: (oError) => {
                    console.error(`Error fetching data from ${joinCondition.mainEntitySet}:`, oError);
                }
            });
        },
        
        // 두 데이터셋을 강제 조인하는 함수
        _joinData: function(aMainData, aJoinData, sMainProperty, sJoinProperty) {
            // 강제 조인된 결과를 저장할 배열
            let aJoinedData = [];
        
            // 메인 데이터셋을 순회하면서 조인할 데이터셋과 비교
            aMainData.forEach(mainItem => {
                // 메인 데이터셋의 joinProperty 값 추출
                const mainKey = mainItem[sMainProperty];
        
                // 조인할 데이터셋에서 joinProperty 값이 동일한 항목 찾기
                const matchedJoinItem = aJoinData.find(joinItem => joinItem[sJoinProperty] === mainKey);
        
                // 메인 항목과 조인 항목을 결합
                aJoinedData.push({
                    ...mainItem,                // 메인 항목
                    ...matchedJoinItem || {}    // 일치하는 항목이 있으면 결합, 없으면 빈 객체 결합
                });
            });
        
            return aJoinedData;
        },
        
        // 결합된 데이터를 모델에 바인딩하는 함수
        _bindCombinedModel: function(oData) {
            // 결합된 데이터를 combinedModel에 설정
            const oCombinedModel = this.getView().getModel("combinedModel");
            oCombinedModel.setData(oData);
        },

        // 외래키 관계 여부를 체크하는 함수 (async/await 사용)
        _checkForeignKeyRelationship: async function(oModel, sEntitySetName1, sEntitySetName2) {
            // 메타데이터 로드 확인 및 로드 대기
            const oMetadata = await this._getMetadataAsync(oModel);

            // 첫 번째 엔티티셋의 엔티티 타입 이름을 추출
            const oEntitySet1 = this._getEntitySetProperties(oMetadata, sEntitySetName1);
            const sEntityTypeName1 = oEntitySet1.entityTypeName;

            // 두 번째 엔티티셋의 엔티티 타입 이름을 추출
            const oEntitySet2 = this._getEntitySetProperties(oMetadata, sEntitySetName2);
            const sEntityTypeName2 = oEntitySet2.entityTypeName;

            // 첫 번째 엔티티 타입의 모든 네비게이션 속성 추출
            const aNavigationProperties1 = this._getNavigationProperties(oMetadata, sEntityTypeName1);

            // 두 번째 엔티티 타입이 첫 번째 엔티티 타입의 네비게이션 속성에 존재하는지 확인
            const bIsRelatedFrom1To2 = aNavigationProperties1.some(navProp => navProp.toEntityType === sEntityTypeName2);

            if (bIsRelatedFrom1To2) {
                return true; // 첫 번째 엔티티셋이 두 번째 엔티티셋과 연관 관계가 있는 경우
            }

            // 두 번째 엔티티 타입의 모든 네비게이션 속성 추출
            const aNavigationProperties2 = this._getNavigationProperties(oMetadata, sEntityTypeName2);

            // 첫 번째 엔티티 타입이 두 번째 엔티티 타입의 네비게이션 속성에 존재하는지 확인
            const bIsRelatedFrom2To1 = aNavigationProperties2.some(navProp => navProp.toEntityType === sEntityTypeName1);

            return bIsRelatedFrom2To1; // 두 번째 엔티티셋이 첫 번째 엔티티셋과 연관 관계가 있는 경우
        },

        // 주어진 모델의 메타데이터를 비동기적으로 가져오는 함수 (메타데이터가 없을 경우 로드)
        _getMetadataAsync: async function(oModel) {
            // 메타데이터가 로드되었는지 확인
            if (!oModel.getServiceMetadata()) {
                // 메타데이터가 없을 경우 로드 대기
                await oModel.metadataLoaded();
            }
            // 메타데이터 반환
            return oModel.getServiceMetadata();
        },

        // 주어진 엔티티 타입의 모든 네비게이션 속성을 추출하는 함수
        _getNavigationProperties: function(oMetadata, sEntityTypeName) {
            // 엔티티 타입을 메타데이터에서 찾음
            const oEntityType = oMetadata.dataServices.schema
                .flatMap(schema => schema.entityType) // 모든 엔티티 타입 추출
                .find(entityType => entityType.name === sEntityTypeName); // 주어진 이름의 엔티티 타입 찾기

            if (!oEntityType) {
                throw new Error(`EntityType '${sEntityTypeName}' not found.`);
            }

            // 네비게이션 속성 목록 반환
            return oEntityType.navigationProperty.map(navProp => ({
                name: navProp.name,               // 네비게이션 속성 이름
                relationship: navProp.relationship, // 관계 이름
                fromRole: navProp.fromRole,       // 시작 역할
                toRole: navProp.toRole,           // 끝 역할
                toEntityType: navProp.type.split('.').pop() // 대상 엔티티 타입 이름
            }));
        },

        // 주어진 엔티티셋 이름에 대한 엔티티셋 정보를 반환하는 함수
        _getEntitySetProperties: function(oMetadata, sEntitySetName) {
            // 엔티티셋 정보를 메타데이터에서 찾음
            const oEntitySet = oMetadata.dataServices.schema
                .flatMap(schema => schema.entityContainer || []) // 모든 엔티티 컨테이너 추출
                .flatMap(container => container.entitySet || []) // 모든 엔티티셋 추출
                .find(entitySet => entitySet.name === sEntitySetName); // 주어진 이름의 엔티티셋 찾기

            if (!oEntitySet) {
                throw new Error(`EntitySet '${sEntitySetName}' not found.`);
            }

            // 엔티티 타입 이름과 속성 정보 반환
            return {
                entityTypeName: oEntitySet.entityType.split('.').pop(), // 엔티티 타입 이름
                properties: oEntitySet.property || [] // 엔티티셋의 속성 정보 (기본적으로 빈 배열 반환)
            };
        }       
    });
});
