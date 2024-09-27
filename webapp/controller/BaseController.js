sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/Label",
    "sap/m/Input",
    "sap/base/util/deepClone",
    "sap/base/util/deepEqual",
    "sap/m/MessageBox"
], function(
    Controller,
    Filter,
    FilterOperator,
    Label,
    Input,
    deepClone,
    deepEqual,
    MessageBox
) {
    "use strict";
    return Controller.extend("com.tipsvally.testproject.controller.BaseController", {
        DialogNames: Object.freeze({
            DIALOG_TEMPLATE_01: "DialogTemplate01"
        }),

        ConstantControlIds: Object.freeze({
            SEARCH_FORM: "search_form",
            MAIN_TABLE: "main_table"
        }),

        InputModelTypes: Object.freeze({
            ADD_MODEL: "add_model",
            UPDATE_MODEL: "update_model"
        }),

        deepClone: function(oValue) {
            return deepClone(oValue);
        },

        deepEqual: function(oClone, oSource) {
            return deepEqual(oClone, oSource);
        },

        getEntityType: async function(oModel, sEntitySet) {
            // 엔터티셋의 메타데이터에서 엔터티 타입을 가져오는 함수
            if(oModel.getMetadata().getName() === 'sap.ui.model.odata.v2.ODataModel' || oModel.getMetadata().getName() === 'sap.ui.model.odata.v4.ODataModel') {
                await oModel.metadataLoaded();
            }
            const oMetadata = oModel.getServiceMetadata();
            for(const oSchema of oMetadata.dataServices.schema) {
                if(oSchema.entityContainer) {
                    for (const oContainer of oSchema.entityContainer) {
                        const oEntitySet = oContainer.entitySet.find((oSet) => oSet.name === sEntitySet);
                        if (oEntitySet) {
                            // __entityType 또는 entityType 중 하나가 있으면 반환
                            return oEntitySet.__entityType || oEntitySet.entityType || null;
                        }
                    }
                }
            }
            return null; // 엔터티 타입을 찾지 못한 경우
        },
        getProperty: function(oEntityType, sKey) {

            // 엔터티 타입에서 특정 필드의 데이터 타입을 가져오는 함수
            let result = null;
            if(oEntityType) {
                oEntityType.property.forEach((oProperty) => {
                    if(oProperty.name === sKey) {
                        result = oProperty;
                    }
                });
            }
            return result; // 필드의 데이터 타입을 반환
        },

        createFilters: function(oSearchModelData, oEntityType) {

            // 검색 모델 데이터를 기반으로 필터를 생성하는 함수
            const aFilters = [];

            Object.entries(oSearchModelData).forEach(([key, value]) => {
                const oProperty = this.getProperty(oEntityType, key);
                if(oProperty) {
                    if(oProperty.type === 'Edm.String') {
                        if(value) {
                            aFilters.push(new Filter(key, FilterOperator.Contains, value));
                        }

                    } else if (oProperty.type === 'Edm.DateTimeOffset') {
                        if (value) {
                            // DatePicker에서 받은 값이 "2024-07-01T00:00:00+09:00" 형식일 때, 타임존을 포함한 값으로 처리
                            const sStartDate = value.split("T")[0] + "T00:00:00.000";
                            const sEndDate = value.split("T")[0] + "T23:59:59.999";

                            // 날짜 범위 필터 추가 (타임존을 유지한 상태로 필터 적용)
                            aFilters.push(new Filter({
                                path: key,
                                operator: FilterOperator.BT,  // Between 연산자
                                value1: sStartDate,  // 시작 날짜 (타임존 포함)
                                value2: sEndDate     // 종료 날짜 (타임존 포함)
                            }));
                        }
                    } else {
                        if(value) {
                            var numericValue = Number(value);
                            aFilters.push(new Filter(key, FilterOperator.EQ, numericValue));
                        }
                    }
                }
            });
            return aFilters;
        },

        onOpenInputDialog: async function({isUpdate=false, rowData=null, table=null, dialogName="", odataModel=null, entitysetName="", dialogModel=null}) {
            // 다이로그 호출 함수
            this.oDialog ??= await this.loadFragment({
                name:`com.tipsvally.testproject.view.fragments.${dialogName}`
            });
            this.oDialog.setTitle(isUpdate ? "데이터 수정" : "데이터 등록");
            this._createDialogInputs(isUpdate, table, odataModel, entitysetName);
            const oSubmitButton = this.byId("idSaveButton");
            if(isUpdate) {
                dialogModel.setData(rowData);
                oSubmitButton.setText("Update");
            } else {
                dialogModel.setData({});
                oSubmitButton.setText("Register");
            }
            this.oDialog.open();
        },

        _createDialogInputs: async function(bIsUpdate, oTable, oODataModel, sEntitysetName) {

            // 다이로그 입력 컴포넌트 동적 생성 함수
            const oColumns = oTable.getColumns();
            const oForm = this.byId('dialogForm');
            oForm.removeAllContent();
            const oEntityType = await this.getEntityType(oODataModel, sEntitysetName);
            const aKeyProperties = oEntityType.key.propertyRef.map(oPropertyRef => oPropertyRef.name);
            const aFormFields = [];

            // 테이블 컬럼에서 설정된 필드와 키 프로퍼티 처리
            oColumns.forEach((oColumn) => {
                const sLabel = oColumn.getHeader().getText();
                const sProperty = oColumn.getHeader().getCustomData()[0].getValue();
                const oProperty = this.getProperty(oEntityType, sProperty);
                if (aKeyProperties.includes(sProperty)) {
                    if (bIsUpdate) {
                        aFormFields.unshift({ label: sLabel, property: sProperty, isKey: true, isEditable: false, type: oProperty.type });
                    } else {
                        aFormFields.unshift({ label: sLabel, property: sProperty, isKey: true, isEditable: true, type: oProperty.type });
                    }
                } else {
                    aFormFields.push({ label: sLabel, property: sProperty, isKey: false, isEditable: true, type: oProperty.type });
                }
            });

            // 등록 시에만 테이블 컬럼에 없는 키 프로퍼티 처리
            if (!bIsUpdate) {
                aKeyProperties.forEach((sKeyProperty) => {
                    const bKeyExistsInColumns = oColumns.some((oColumn) => {
                        const sProperty = oColumn.getHeader().getCustomData()[0].getValue();
                        return sProperty === sKeyProperty;
                    });
                    if (!bKeyExistsInColumns) {
                        const oProperty = this.getProperty(oEntityType, sKeyProperty);
                        aFormFields.unshift({ label: sKeyProperty, property: sKeyProperty, isKey: true, isEditable: true, type: oProperty.type });
                    }
                });
            }

            // Form에 동적 필드 추가
            aFormFields.forEach((oField) => {
                oForm.addContent(new Label({ text: oField.label }));
                let oInput;
                if (oField.type === "Edm.DateTime" || oField.type === "Edm.DateTimeOffset") {
                    oInput = new sap.m.DatePicker({
                        value: `{${bIsUpdate ? this.InputModelTypes.UPDATE_MODEL : this.InputModelTypes.ADD_MODEL}>/${oField.property}}`,
                        displayFormat: "yyyy-MM-dd (EEE)",
                        valueFormat: "yyyy-MM-dd'T'HH:mm:ss",
                        enabled: oField.isEditable
                    });
                } else {
                    oInput = new Input({
                        value: `{${bIsUpdate ? this.InputModelTypes.UPDATE_MODEL : this.InputModelTypes.ADD_MODEL}>/${oField.property}}`,
                        enabled: oField.isEditable,
                        type: this.getInputType(oField.type)
                    });
                }
                if (oField.isKey && !bIsUpdate) {
                    oInput.setRequired(true);
                }
                oForm.addContent(oInput);
            });
        },

        getInputType: function(sEdmType) {
            // OData 타입에 따른 Input 타입을 반환하는 함수
            switch (sEdmType) {
                case "Edm.String":
                    return "Text";
                case "Edm.Int32":
                case "Edm.Int64":
                case "Edm.Decimal":
                    return "Number";
                case "Edm.Boolean":
                    return "Checkbox";
                case "Edm.Date":
                case "Edm.DateTime":
                    return "Date";
                default:
                    return "Text"; // 기본값은 텍스트로 설정
            }
        },
        validateInputs: async function(oODataModel, sEntitysetName) {
            // 다이로그 입력 컴포넌트 값 유효성 검사 함수
            const oForm = this.byId('dialogForm');
            const oControls = oForm.getContent();
            const oEntityType = await this.getEntityType(oODataModel, sEntitysetName);
            for (let i = 0; i < oControls.length; i += 2) {
                const oLabel = oControls[i];
                const oInput = oControls[i + 1];
                const sProperty = oInput.getBinding("value").getPath().split("/").pop();
                const oPropertyMetadata = this.getProperty(oEntityType, sProperty);
                const sValue = oInput.getValue().trim();
                if (!sValue) {
                    MessageBox.error(`${oLabel.getText()}을(를) 입력해야 합니다.`);
                    return false;
                }

                if (oPropertyMetadata) {
                    switch (oPropertyMetadata.type) {
                        case "Edm.String":
                            break;
                        case "Edm.Int32":
                        case "Edm.Int64":
                        case "Edm.Decimal":
                            if (isNaN(sValue)) {
                                MessageBox.error(`${oLabel.getText()}은(는) 숫자여야 합니다.`);
                                return false;
                            }
                            break;
                        case "Edm.Boolean":
                            if (sValue !== "true" && sValue !== "false") {
                                MessageBox.error(`${oLabel.getText()}은(는) true 또는 false여야 합니다.`);
                                return false;
                            }
                            break;
                        case "Edm.DateTime":
                        case "Edm.DateTimeOffset":
                            if (!this.isValidDate(sValue)) {
                                MessageBox.error(`${oLabel.getText()}은(는) 유효한 날짜여야 합니다.`);
                                return false;
                            }
                            break;
                        default:
                            break;
                    }
                }
            }
            return true;
        },

        isValidDate: function(sDate) {
            //날짜 형식 검증 함수
            const date = Date.parse(sDate);
            return !isNaN(date);
        },

        isDataChanged: function(oNewData, oOldData) {
            // model 데이터 변경 여부 체크 함수
            return JSON.stringify(oNewData) !== JSON.stringify(oOldData);
        },

        _showDeleteResult: function(iSuccessCount, iErrorCount) {
            // 삭제 결과 메세지 생성 함수
            if (iSuccessCount > 0 && iErrorCount === 0) {
                MessageBox.success(`${iSuccessCount}개의 데이터가 성공적으로 삭제되었습니다.`);
            } else if (iSuccessCount > 0 && iErrorCount > 0) {
                MessageBox.warning(`${iSuccessCount}개의 데이터가 성공적으로 삭제되었지만, ${iErrorCount}개의 데이터 삭제에 실패했습니다.`);
            } else if (iErrorCount > 0) {
                MessageBox.error(`${iErrorCount}개의 데이터 삭제에 실패했습니다.`);
            }
        },

        // 주어진 모델의 메타데이터를 비동기적으로 가져오는 함수 (메타데이터가 없을 경우 로드)  
        _getMetadataAsync: async function(oModel) {
            
            // 모델 타입 체크: oData V2 또는 V4 모델인지 확인
            if (!(oModel instanceof sap.ui.model.odata.v2.ODataModel || oModel instanceof sap.ui.model.odata.v4.ODataModel)) {
                throw new Error("Invalid model type. Expected an instance of OData V2 or V4 model.");
            }

            // 메타데이터가 로드되었는지 확인
            if(!oModel.getServiceMetadata()) {
                // 메타데이터가 없을 경우 로드 대기
                await oModel.metadataLoaded();
            }

            // 메타데이터 반환
            return oModel.getServiceMetadata();
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

            // 엔티티 타입 이름과 속성 정보 찾기
            const sEntityTypeName = oEntitySet.entityType.split('.').pop(); // 간단한 엔티티 타입 이름 추출

            // 엔티티 타입 정보 추출
            const oEntityType = oMetadata.dataServices.schema
                .flatMap(schema => schema.entityType || []) // 모든 엔티티 타입 추출
                .find(entityType => entityType.name === sEntityTypeName); // 주어진 엔티티 타입 이름으로 찾기

            if (!oEntityType) {
                throw new Error(`EntityType '${sEntityTypeName}' not found.`);
            }

            // 키 속성 목록 추출
            const aKeyProperties = oEntityType.key.propertyRef.map(prop => prop.name);

            // 속성 정보 구성 (각 속성에 isKey 속성 추가)
            const aProperties = oEntityType.property.map(prop => ({
                ...prop,                                    // 기존 prop 객체 복사
                isKey: aKeyProperties.includes(prop.name)   // 키 속성 여부 추가
            }));

            // 엔티티 타입 이름과 속성 정보 반환
            return {
                entityTypeName: oEntityType.name, // 엔티티 타입 이름
                properties: aProperties || [] // 속성 정보 배열 (기본적으로 빈 배열 반환)
            };
        },
        
        // 외래키 관계 여부를 체크하는 함수(단방향 체크, 명확한 관계 확인)
        _checkForeignKeyRelationship: async function(oModel,  sEntitySetName1, sEntitySetName2) {
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

            // 첫 번째 엔티티셋이 두 번째 엔티티셋과 연관관계가 있는 경우
            return bIsRelatedFrom1To2;
        },

        // 주어진 엔티티 타입의 모든 네비게이션 속성을 추출하는 함수
        _getNavigationProperties: function(oMetadata, sEntityTypeName) {
            // 엔티티 타입을 메타데이터에서 검색
            const oEntityType = oMetadata.dataServices.schema
                .flatMap(oSchema => oSchema.entityType) // 모든 엔티티 타입 추출
                .find(entityType => entityType.name === sEntityTypeName); // 주어진 이름의 엔티티 타입 찾기

            if(!oEntityType) {
                throw new Error(`EntityType '${sEntityTypeName}' not found.`);
            }

            // 네비게이션 속성 목록 반환
            return oEntityType.navigationProperty.map(navProp => ({
                name: navProp.name,                         // 네이비게이션 속성 이름
                relationship: navProp.relationship,         // 관계 이름
                fromRole: navProp.fromRole,                 // 시작 역할
                toRole: navProp.toRole,                     // 끝 역할
                toEntityType: navProp.type.split('.').pop() // 대상 엔티티 타입 이름
            }));
        },
        
        // 두 데이터셋을 강제 조인하는 함수
        _joinData: function(aMainData, aJoinData, sMainProperty, sJoinProperty) {
            // 강제 조인된 결과를 저장할 배열
            const aJoinedData = [];
            
            // 메인 데이터셋을 순회하면서 조인할 데이터셋 비교
            aMainData.forEach(mainItem => {
              //메인 데이터셋의 joinProperty 값 추출
              const mainKey = mainItem[sMainProperty];
  
              // 조인할 데이터셋에서 joinProperty 값이 동일한 항목 찾기
              const matchedJoinItem = aJoinData.find(joinItem => joinItem[sJoinProperty] === mainKey);
              aJoinData.push({
                  ...mainItem,                        // 메인 항목
                  ...matchedJoinItem || {}            // 일치하는 항목이 있으면 결합, 없으면 빈 객체 결합
              });
            });
            
            return aJoinData;
        },

        // 결합된 데이터를 모델에 바인딩하는 함수
        _bindCombinedModel: function(oCombinedModel, oData) {
            oCombinedModel ??= this.getView().getModel("combinedModel");

            // oData는 { data: [] } 형태여야 함
            if (!oData || !Array.isArray(oData.data)) {
                console.error("Invalid data format. Expected { data: [] } format.");
                return;
            }

            // combinedModel에 데이터 설정
            oCombinedModel.setData(oData);
            console.log("Combined data set to model:", oData);
        },

        // 두 데이터셋을 결합하는 함수
        _getJoinedData: function(oData1, oData2, joinCondition) {
            // joinProperty가 둘 중 하나라도 null인지 확인
            if (!joinCondition.mainJoinProperty || !joinCondition.joinJoinProperty) {
                console.log("One or both join properties are null, combining data by index.");
        
                // 강제 조인 없이 인덱스 순으로 데이터 결합
                return oData1.results.map((item1, index) => ({
                    ...item1,
                    ...(oData2.results[index] || {}) // 인덱스에 해당하는 조인 데이터 추가
                }));
            } else {
                console.log("Both join properties are valid, performing join.");
        
                // 두 joinProperty가 모두 유효할 경우 강제 조인
                return this._joinData(
                    oData1.results,
                    oData2.results,
                    joinCondition.mainJoinProperty,
                    joinCondition.joinJoinProperty
                );
            }
        },

        // 서로 다른 모델 간 강제 조인 수행
        _performForcedJoinBetweenModels: async function(joinCondition) {
            try {
                // 메인 모델의 데이터를 읽어옴
                const oData1 = await this._readODataAsync(joinCondition.mainModel, joinCondition.mainEntitySet, null);

                // 조인할 모델의 데이터를 읽어옴
                const oData2 = await this._readODataAsync(joinCondition.joinModel, joinCondition.joinEntitySet, null);

                // _getJoinedData 함수 호출하여 결합된 데이터 반환
                const oJoinedData = this._getJoinedData(oData1, oData2, joinCondition);

                // 결합된 데이터 바인딩
                this._bindCombinedModel(null, {data: oJoinedData});
            } catch (oError) {
                console.error(`Error performing forced join between different models:`, oError);
            }
        },

        // OData 데이터를 비동기적으로 읽어오는 함수 (Promise 반환)
        _readODataAsync: function(oModel, sEntitySetName, urlParameters = {}) {
            return new Promise((resolve, reject) => {
                oModel.read(`/${sEntitySetName}`, {
                    urlParameters,      // 동적으로 설정된 URL 파라미터 사용
                    success: resolve,   // 성공 시 OData 결과를 resolve로 전달
                    error: reject       // 실패 시 reject로 오류 전달
                });
            });
        },

        // 강제 조인 조건을 받아 같은 모델 내의 데이터를 결합하는 함수
        _performForcedJoin: async function(joinCondition) {
            try {
                // 메인 모델의 데이터를 읽어옴
                const oData1 = await this._readODataAsync(joinCondition.mainModel, joinCondition.mainEntitySet, null);

                // 조인할 모델의 데이터를 읽어옴 (같은 모델 사용)
                const oData2 = await this._readODataAsync(joinCondition.mainModel, joinCondition.joinEntitySet, null);

                 // _getJoinedData 함수 호출하여 결합된 데이터 반환
                const oJoinedData = this._getJoinedData(oData1, oData2, joinCondition);

                // 결합된 데이터 바인딩
                this._bindCombinedModel(null, {data: oJoinedData});

            } catch (oError) {
                console.error(`Error performing forced join within the same model:`, oError);
            }
        },
    });

});