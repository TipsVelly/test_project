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

        ODataOperationTypes : Object.freeze({
            CREATE: "create",
            UPDATE: "update",
            DELETE: "delete"
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

            /// 엔티티셋에서 엔티티 타입 이름 추출
            const sEntityTypeName1 = this._getEntityTypeName(oMetadata, sEntitySetName1);
            const sEntityTypeName2 = this._getEntityTypeName(oMetadata, sEntitySetName2);

            // 첫 번째 엔티티 타입의 네비게이션 속성 확인
            return this._findNavigationProperty(oMetadata, sEntityTypeName1, sEntityTypeName2);
        },

        // 주어진 엔티티셋의 엔티티 타입 이름을 추출하는 함수
        _getEntityTypeName: function(oMetadata, sEntitySetName) {
            const oEntitySet = this._getEntitySetProperties(oMetadata, sEntitySetName);
            return oEntitySet.entityTypeName;
        },

        // 첫 번째 엔티티 타입에서 두번 째 타입의 속성과 일치하는 네비게이션 속성 반환하는 함수
        _findNavigationProperty: function(oMetadata, sEntityTypeName1, sEntityTypeName2) {
            const aNavigationProperties = this._getNavigationProperties(oMetadata, sEntityTypeName1);
            

            return aNavigationProperties.find(navProp => {
                const targetEntityType = navProp.toEntityType || this._getEntityTypeFromAssociation(oMetadata, navProp); // 네비게이션 속성에 대상 엔티티 타입이 명시되지 않은 경우, Association을 통해 추적
                return targetEntityType === sEntityTypeName2;
            });   
        },

        // 첫 번째 엔티티 타입이 두 번째 엔티티 타입을 네비게이션 속성으로 가지고 있는지 확인하는 함수
        _hasNavigationToEntityType: function(oMetadata, sEntityTypeName1, sEntityTypeName2) {
            return aNavigationProperties.some(navProp => {
                let targetEntityType = navProp.toEntityType || this._getEntityTypeFromAssociation(oMetadata, navProp); // 네비게이션 속성에 대상 엔티티 타입이 명시되지 않은 경우, Association을 통해 추적
                return targetEntityType === sEntityTypeName2;
            });
        },

        // 주어진 네비게이션 속성에서 Association을 통해 엔티티 타입을 찾는 함수
        _getEntityTypeFromAssociation: function(oMetadata, navProp) {
            const oAssociation = this._findAssociation(oMetadata, navProp.relationship);

            // Association의 fromRole 또는 toRole에 따라 대상 엔티티 타입을 결정
            if (navProp.fromRole === oAssociation.end[0].role) {
                return oAssociation.end[1].type.split('.').pop(); // toRole에 해당하는 엔티티 타입
            } else {
                return oAssociation.end[0].type.split('.').pop(); // fromRole에 해당하는 엔티티 타입
            }
        },

        // 주어진 관계 이름으로 Association을 찾는 함수
        _findAssociation: function(oMetadata, sRelationship) {
            const oAssociation = oMetadata.dataServices.schema
                .flatMap(oSchema => oSchema.association) // 모든 Association 추출
                .find(assoc => assoc.name === sRelationship.split('.').pop()); // 주어진 관계 이름으로 찾기

            if (!oAssociation) {
                throw new Error(`Association '${sRelationship}' not found.`);
            }
            return oAssociation;
        },

        // 주어진 엔티티 타입의 모든 네비게이션 속성을 추출하는 함수
        _getNavigationProperties: function(oMetadata, sEntityTypeName) {
            // 엔티티 타입을 메타데이터에서 검색
            const oEntityType = this._findEntityType(oMetadata, sEntityTypeName);
            
            // 네비게이션 속성 목록 반환
            return oEntityType.navigationProperty.map(navProp => ({
                name: navProp.name,                         // 네비게이션 속성 이름
                relationship: navProp.relationship,         // 관계 이름
                fromRole: navProp.fromRole,                 // 시작 역할
                toRole: navProp.toRole,                     // 끝 역할
                toEntityType: navProp.type ? navProp.type.split('.').pop() : null // 대상 엔티티 타입 이름 (없을 수도 있음)
            }));
        },

        // 주어진 이름의 엔티티 타입을 검색하는 함수
        _findEntityType: function(oMetadata, sEntityTypeName) {
            const oEntityType = oMetadata.dataServices.schema
                .flatMap(oSchema => oSchema.entityType)     // 모든 엔티티 타입 추출
                .find(entityType => entityType.name === sEntityTypeName); // 주어진 이름의 엔티티 타입 찾기

            if (!oEntityType) {
                throw new Error(`EntityType '${sEntityTypeName}' not found.`);
            }
            return oEntityType;
        },
        
        // 두 데이터셋을 강제 조인하는 함수
        _joinData: function(aMainData, aJoinData, sMainProperty, sJoinProperty) {
            // 강제 조인된 결과를 저장할 배열
            const aJoinedData = [];
            
            // 메인 데이터셋을 순회하면서 조인할 데이터셋 비교
            aMainData.forEach(mainItem => {
              //메인 데이터셋의 joinProperty 값 추출
              const mainKey = mainItem[sMainProperty];

              if(!mainKey) {
                throw new Error("mainModel에서 강제조인할 entity property를 찾을 수 없습니다.");
              }

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
        _getJoinedData: function(oData1, joinProperty1, oData2, joinProperty2) {
            // joinProperty가 둘 중 하나라도 null인지 확인
            if (!joinProperty1 || !joinProperty2) {
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
                    joinProperty1,
                    joinProperty2
                );
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
        _performForcedJoin: async function(
            {oModel: oMainModel, sEntitySet: sMainEntitySet, sJoinProperty: sMainJoinProperty}, 
            {oModel: oSubModel, sEntitySet: sSubEntitySet, sJoinProperty: sSubJoinProperty}) 
            {
            try {
                // 메인 모델의 데이터를 읽어옴
                const oData1 = await this._readODataAsync(oMainModel, sMainEntitySet, null);

                // 조인할 모델의 데이터를 읽어옴 (같은 모델 사용)
                const oData2 = await this._readODataAsync(oSubModel, sSubEntitySet, null);

                 // _getJoinedData 함수 호출하여 결합된 데이터 반환
                const aJoinData = this._getJoinedData(oData1, sMainJoinProperty, oData2, sSubJoinProperty);

                return aJoinData;

            } catch (oError) {
                console.error(`Error performing forced join within the same model:`, oError);
                throw new Error("Error iccurs!", oError);
            }
        },
        // 외래키 관계 여부를 체크하는 함수(단방향 체크, 명확한 관계 확인)
        loadCombinedData: async function (oTable, ...aOptions) {
            try {
                const oMainOption = aOptions[0]; // 메인 옵션
                const aExpandNavigationProperties = [];
                const aJoinConditions = [];
                let aData = []; // 누적 데이터 저장할 배열
                let aMetadata = []; // 누적 메타데이터 저장할 배열

                // 메인 엔티티의 메타데이터 및 컬럼 정보
                const oMainEntityMetadata = await this._getMetadataAsync(oMainOption.oModel);
                const OMainEntitySetProperties = this._getEntitySetProperties(oMainEntityMetadata, oMainOption.sEntitySet);

                // 메인 데이터에 대한 메타데이터 생성
                aMetadata = [...this._createColumnMetadata(OMainEntitySetProperties, oMainOption.sEntitySet, oMainOption.oModel)];

                // 1. 메인 데이터 가져오기
                const oMainData = await this._readODataAsync(oMainOption.oModel, oMainOption.sEntitySet, null);
                aData = oMainData.results; // 메인 데이터 저장

                // 2. 모든 서브 OData와 메인 OData 비교
                for (let i = 1; i < aOptions.length; i++) {
                    const oCurrentOption = aOptions[i];

                    // 외래키 여부 확인 ($expand 가능 여부 확인)
                    const isForeignKeyRelated = oCurrentOption.oModel.sServiceUrl === oMainOption.oModel.sServiceUrl &&
                        await this._checkForeignKeyRelationship(oMainOption.oModel, oMainOption.sEntitySet, oCurrentOption.sEntitySet);

                    if (isForeignKeyRelated) {
                        // 외래키가 있으면 해당 엔티티셋의 navigationProperty 이름을 $expand 대상에 추가
                        aExpandNavigationProperties.push({...oCurrentOption, navigationPropName:isForeignKeyRelated.name});
                    } else {
                        // 외래키가 없으면 강제 조인 설정
                        aJoinConditions.push(oCurrentOption);
                    }
                }

                // 3. $expand로 데이터를 가져오기
                if (aExpandNavigationProperties.length > 0) {
                    // $expand에 사용할 navigationProperty 이름들을 ','로 결합하여 쿼리 생성
                    const sExpandQuery = aExpandNavigationProperties.map(expandNavProps => expandNavProps.navigationPropName).join(',');

                    // $expand로 확장된 데이터를 가져옴
                    const oExpandedData = await this._readODataAsync(oMainOption.oModel, oMainOption.sEntitySet, { "$expand": sExpandQuery });

                    // 1. 기존 테이블 컬럼 제거
                    oTable.removeAllColumns();

                    // 2. 테이블의 기존 항목 템플릿 가져오기
                    const oTemplate = oTable.getBindingInfo("items").template;

                    // 3. 테이블에 기존 템플릿으로 다시 바인딩
                    oTable.bindItems({
                        path: `${sModelName}>${sPath}`,
                        template: oTemplate // 기존 템플릿을 재사용
                    });
                    
                }
                
                // 4. 강제 조인 처리
                if (aJoinConditions.length > 0) {
                    for (const oJoinCondition of aJoinConditions) {
                        // 각 서브 엔티티셋의 데이터를 강제 조인
                        const aJoinedData = await this._performForcedJoin(
                            {
                                oModel: oMainOption.oModel,
                                sEntitySet: oMainOption.sEntitySet,
                                sJoinProperty: oMainOption.sJoinProperty
                            },
                            {
                                oModel: oJoinCondition.oModel,
                                sEntitySet: oJoinCondition.sEntitySet,
                                sJoinProperty: oJoinCondition.sJoinProperty
                            }
                        );

                        const oSubMetadata = await this._getMetadataAsync(oJoinCondition.oModel);
                        const oSubEntityProperties = this._getEntitySetProperties(oSubMetadata, oJoinCondition.sEntitySet);

                        // 서브 데이터의 필드를 메인 데이터의 각 행에 열로 추가
                        const mergedDataResult = this._addColumnsToMainData(aData, aJoinedData, oMainOption.sJoinProperty, oJoinCondition.sJoinProperty, aMetadata, oSubEntityProperties, oJoinCondition.sEntitySet, oJoinCondition.oModel);

                        // 메타데이터와 데이터를 업데이트
                        aData = mergedDataResult.data;
                        aMetadata = mergedDataResult.metadata;
                    }
                }

                // 5. 최종적으로 메타데이터와 데이터를 모델에 바인딩
                this._bindCombinedModel(null, { metadata: aMetadata, data: aData });

            } catch (oError) {
                console.error("Error loading combined data:", oError);
            }
        },

        _createColumnMetadata: function(oEntitySet, sEntitySetName, oModel) {
            // oEntitySet: 엔티티셋의 메타데이터
            // sEntitySetName: 엔티티셋 이름 (출처 정보)

            return oEntitySet.properties.map(property => ({
                columnName: property.name,                      // 컬럼 이름 (프로퍼티 이름)
                isKey: property.isKey || false,                 // 키값 여부 (키 값일 경우, true)
                entitySet: sEntitySetName,                      // 컬럼이 속한 엔티티셋 이름 (출처 정보)
                oModel: oModel
            }));
        },
        /**
         * 메타데이터를 변환하여 컬럼 메타데이터 배열을 생성하는 함수
         * 
         * @param {Object} metadata - OData 모델에서 가져온 서비스 메타데이터
         * @param {Object} oModel - OData 모델 객체
         * 
         * @returns {Array} 변환된 컬럼 메타데이터 배열
         */
        _convertColumnMetadata: function(metadata, oModel) {
            const expandedMetadata = [];
            const existingColumns = new Set();  // 중복 확인용 Set

            // 메타데이터 내 엔티티 타입 순회
            metadata.dataServices.schema.forEach(schema => {
                schema.entityContainer.forEach(container => {
                    container.entitySet.forEach(entitySet => {
                        const sEntitySetName = entitySet.name; // 엔티티셋 이름 동적으로 추출
                        const sEntityTypeName = entitySet.entityType.split('.').pop(); // 엔티티 타입 이름 동적으로 추출

                        // 해당 엔티티셋의 엔티티 타입 찾기
                        const entityType = schema.entityType.find(et => et.name === sEntityTypeName);

                        if (entityType) {
                            // 엔티티 타입에서 키 속성 추출
                            const keyProperties = entityType.key.propertyRef.map(key => key.name);

                            // 기존 속성 메타데이터 처리
                            entityType.property.forEach(property => {
                                let columnName = property.name;

                                // 중복 확인
                                if (existingColumns.has(columnName)) {
                                    columnName = `${sEntityTypeName}_${columnName}`;  // 중복 시 엔티티 타입 이름을 붙여 구분
                                }

                                expandedMetadata.push({
                                    columnName: columnName,                // 컬럼 이름 (프로퍼티 이름)
                                    isKey: keyProperties.includes(property.name),  // 키 여부 확인
                                    entitySet: sEntitySetName,             // 컬럼이 속한 엔티티셋 이름
                                    entityType: sEntityTypeName,           // 엔티티 타입 이름
                                    oModel: oModel                        // 모델 정보
                                });

                                // 추가한 컬럼명을 Set에 기록
                                existingColumns.add(columnName);
                            });

                            // 네비게이션 속성에 대한 확장 처리
                            entityType.navigationProperty.forEach(navProp => {
                                const navEntityType = navProp.relationship; // 관계형 엔티티 타입을 찾음
                                const refEntityType = metadata.dataServices.schema.find(s => s.namespace === navEntityType);

                                if (refEntityType) {
                                    refEntityType.entityType.forEach(refEntity => {
                                        const refEntityTypeName = refEntity.name; // 참조된 엔티티 타입 이름

                                        // 참조되는 엔티티의 키 속성 추출
                                        const refKeyProperties = refEntity.key.propertyRef.map(key => key.name);

                                        refEntity.property.forEach(refProp => {
                                            let columnName = `${navProp.name}_${refProp.name}`;  // 기본 확장된 필드명

                                            // 중복 확인
                                            if (existingColumns.has(columnName)) {
                                                columnName = `${refEntityTypeName}_${refProp.name}`;  // 중복 시 참조된 엔티티 타입 이름 추가
                                            }

                                            expandedMetadata.push({
                                                columnName: columnName,                // 확장된 필드 이름 생성
                                                isKey: refKeyProperties.includes(refProp.name),  // 참조된 필드가 키인지 확인
                                                entitySet: sEntitySetName,             // 확장된 필드가 속한 엔티티셋 이름
                                                entityType: refEntityTypeName,         // 확장된 필드가 속한 엔티티 타입 이름
                                                oModel: oModel                        // 모델 정보
                                            });

                                            // 추가한 컬럼명을 Set에 기록
                                            existingColumns.add(columnName);
                                        });
                                    });
                                }
                            });
                        }
                    });
                });
            });

            return expandedMetadata;
        },    

        _mergeAndAddExpandData: function(aMainData, aExpandedData, aMetadata, oExpandedEntityProperties, sEntitySetName, oModel) {
            // aMainData: 메인 데이터 배열
            // aExpandedData: 확장된 데이터 배열
            // aMetadata: 기존 메타데이터 배열
            // oExpandedEntityMetadata: 확장된 엔티티의 메타데이터
            // sEntitySetName: 확장된 엔티티셋 이름
            // oModel: 확장된 엔티티셋의 모델
        
            // 1. 확장된 엔티티의 메타데이터 생성 및 추가
            const expandedMetadata = this._createColumnMetadata(oExpandedEntityProperties, sEntitySetName, oModel);
        
            // 기존 메타데이터에 확장된 엔티티셋의 메타데이터를 추가 (중복 방지)
            expandedMetadata.forEach(meta => {
                if (!aMetadata.some(m => m.columnName === meta.columnName)) {
                    aMetadata.push(meta);
                }
            });
        
            // 2. 메인 데이터와 확장 데이터를 병합
            const aUpdatedData = aMainData.map(mainRow => {
                // 확장된 데이터와 메인 데이터를 조인하는 로직 (기본적으로 확장된 데이터는 중첩 구조)
                const expandedRow = aExpandedData.find(expandRow => expandRow.ID === mainRow.ID); // 조인 조건은 상황에 맞게 설정
        
                if (expandedRow) {
                    Object.keys(expandedRow).forEach(key => {
                        // 확장된 데이터를 메인 데이터에 병합
                        if (typeof expandedRow[key] === 'object' && expandedRow[key] !== null) {
                            mainRow[key] = expandedRow[key]; // 중첩 객체 데이터를 메인 데이터에 추가
                        }
                    });
                }
        
                return mainRow;
            });
        
            // 3. 병합된 메타데이터와 데이터를 반환
            return {
                metadata: aMetadata,
                data: aUpdatedData
            };
        },

        _addColumnsToMainData: function(aMainData, aJoinedData, sMainJoinProperty, sSubJoinProperty, aMetadata, oSubEntityProperties, sSubEntitySetName, oSubModel) {
            // aMainData: 메인 데이터 배열
            // aJoinedData: 서브 데이터 배열
            // sMainJoinProperty: 메인 데이터와 서브 데이터를 조인할 메인 키 값 (메인 데이터 필드)
            // sSubJoinProperty: 서브 데이터에서 조인할 필드 (서브 데이터 필드)
            // aMetadata: 메인 메타데이터 배열
            // oSubEntityProperties: 서브 데이터의 메타데이터 (서브 엔티티셋의 필드 정보)
            // sSubEntitySetName: 서브 엔티티셋 이름
            // oSubModel: 서브 데이터가 속한 모델
            
            // 1. 서브 데이터의 메타데이터 생성
            const newSubMetadata = this._createColumnMetadata(oSubEntityProperties, sSubEntitySetName, oSubModel);

            // 2. 메인 데이터에 서브 데이터를 열로 추가
            const aUpdatedData = aMainData.map(mainRow => {
                // 메인 데이터의 조인 키 값 가져오기
                const mainKey = mainRow[sMainJoinProperty];

                // 서브 데이터에서 조인할 항목 찾기
                const joinedRow = aJoinedData.find(joinRow => joinRow[sSubJoinProperty] === mainKey);

                // 서브 데이터가 존재하면 해당 열을 메인 데이터에 추가, 없으면 빈 값으로 처리
                if (joinedRow) {
                    Object.keys(joinedRow).forEach(key => {
                        if (!mainRow.hasOwnProperty(key)) {
                            mainRow[key] = joinedRow[key]; // 서브 데이터의 컬럼을 메인 데이터에 추가
                        }
                    });
                } else {
                    // 서브 데이터가 없을 경우, 서브 데이터에 있는 필드만큼 빈 값 처리
                    newSubMetadata.forEach(subMeta => {
                        if (!mainRow.hasOwnProperty(subMeta.columnName)) {
                            mainRow[subMeta.columnName] = ""; // 빈 값으로 채움
                        }
                    });
                }

                return mainRow;
            });             

            // 3. {metadata, data} 형태로 반환
            return {
                metadata: [...aMetadata, ...newSubMetadata],
                data: aUpdatedData
            }
        },

        // 출처 정보를 기반으로 OData 모델을 찾는 함수
        _getModelForEntityFromJsonModel: function(oJsonModel, sEntitySet) {
            const oMetadata = oJsonModel.metadata.find(metadata => metadata.entitySet === sEntitySet);
            return oMetadata ? oMetadata.oModel : null;
        },

        // JSONModel에서 metadata와 data 구조를 기반으로 엔티티의 키 정보를 사용하여 URI를 생성하는 함수
        _createUriFromJsonModel: function(oJsonModel, sEntitySet, oData) {
            // metadata에서 해당 entitySet의 키 필드만 필터링
            const aEntityKeyMetadata = oJsonModel.metadata.filter(metadata => metadata.entitySet === sEntitySet && metadata.isKey);
            if(!aEntityKeyMetadata || aEntityKeyMetadata === 0) {
                throw new Error(`엔티티셋 '${sEntitySet}'에 대한 키 메타데이터를 찾을 수 없습니다.`);
            }
            
            // 키 값 조합하여 URI의 키 부분을 생성
            const sKey = aEntityKeyMetadata
                .map(metadata => `${metadata.columnName}='${oData[metadata.columnName]}'`)
                .join(',');

            // 최종 URI 생성
            return `/${sEntitySet}(${sKey})`;
        },

        // 엔티티 키 정보를 기반으로 URI를 생성하는 함수
        createUriFromMetadata: function(oEntityType, oData) {
            const aKeyProperties = oEntityType.key.propertyRef.map(ref => ref.name);                        // 키 필드 이름 추출
            const sKey = aKeyProperties                                                                     // 키 값 조합
                .map(sKeyProperty => `${sKeyProperty}='${oData[sKeyProperty]}'`)
                .join(',');

            return sKey;
        },

        _executeODataOperation: function(oModel, sUri, oData = null, sOperation) {
            return new Promise((resolve, reject) => {
                switch (sOperation) {
                    case "create":
                        oModel.create(sUri, oData, {
                            success: () => {
                                MessageBox.success('데이터가 성공적으로 생성되었습니다.');
                                resolve();
                            }, 
                            error: (oError) => {
                                MessageBox.error("데이터 생성에 실패하였습니다.");
                                reject(oError);
                            }
                        });
                        break;
                    
                    case "update":
                        oModel.update(sUri, oData, {
                            success: () => {
                                MessageBox.success('데이터가 성공적으로 수정되었습니다.');
                                resolve();
                            }, 
                            error: (oError) => {
                                MessageBox.error("데이터 수정에 실패했습니다.");
                                reject(oError);
                            }
                        });
                        break;
                    
                    case "delete":
                        oModel.remove(sUri, {
                            success: function() {
                                MessageBox.success("데이터가 성공적으로 삭제되었습니다.");
                                resolve();
                            },
                            error: function(oError) {
                                MessageBox.error("데이터 삭제에 실패했습니다.");
                                reject(oError);
                            }
                        });
                        break;
                    default:
                        reject(new Error("지원되지 않는 OData 작업입니다."))
                }
            });
        },
        createCombindedEntityFromJsonModel: async function(oJsonModel, oNewData) {
            try {
                // 각 엔티티셋에 대해 CUD 작업을 수행 (reduce로 변경)
                const aCreatePromises = oJsonModel.metadata.reduce((promises, metadata) => {
                    const sEntitySet = metadata.entitySet;
                    const oModel = this._getModelForEntityFromJsonModel(oJsonModel, sEntitySet);

                    if(!oModel) {
                        throw new Error(`OData 모델을 찾을 수 없습니다: ${sEntitySet}`);
                    }

                    // 엔티티셋에 대한 기본 URI 생성(생성 시에는 키가 필요 없음)
                    const sUri = `/${sEntitySet}`;

                    // OData create 요청을 비동기로 수행하여 Promise 배열에 추가
                    const promise = this._executeODataOperation(oModel, sUri, oNewData, this.ODataOperationTypes.CREATE);

                    // 현재 Promise를 배열에 누적
                    return [...promises, promise];      // 누적된 Promise 배열 반환
                }, []); // 초기값을 빈 배열로 설정

                // 모든 생성 요청이 완료될 때까지 기다림(대기)
                await Promise.all(aCreatePromises);
                console.log("모든 데이터가 성공적으로 생성되었습니다.");                            
            } catch (oError) {
                console.error("Error during combined create operation:", oError);
            }
        },

        updateCombinedEntityFromJsonModel: async function(oJsonModel, oUpdatedData) {
            try {
                // 각 엔티티셋에 대해 Update 작업을 수행(reduce로 변경)
                const aUpdatePromises = oJsonModel.metadata.reduce((promises, metadata) => {
                    const sEntitySet = metadata.entitySet;
                    const oModel = this._getModelForEntityFromJsonModel(oJsonModel, sEntitySet);

                    if(!oModel) {
                        throw new Error(`OData 모델을 찾을 수 없습니다: ${sEntitySet}`);
                    }

                    // 해당 entitySet의 데이터를 식별하여 URI 생성
                    const sUri = this._createUriFromJsonModel(oJsonModel, sEntitySet, oUpdatedData);

                    // OData update 요청을 비동기로 수행하여 Promise 배열에 추가
                    const promise = this._executeODataOperation(oModel, sUri, oUpdatedData, this.ODataOperationTypes.UPDATE);

                    // 현재 Promise를 배열에 누적
                    return [...promises, promise];      // 누적된 Promise 배열 반환
                }, []); // 초기값을 빈 배열로 설정

                // 모든 업데이트 요청이 완료될 때까지 기다림(대기)
                await Promise.all(aUpdatePromises);
                console.log("모든 데이터가 성공적으로 수정되었습니다.");

            } catch (oError) {
                console.error("Error during combined update operation:", oError);
            }
        },

        deleteCombinedEntityFromJsonModel: async function(oJsonModel, oDataToDelete) {
            try {
                // 각 엔티티셋에 대해 Delete 작업을 수행 (reduce)
                const aDeletionPromises = oJsonModel.metadata.reduce((promises, metadata) => {
                    const sEntitySet = metadata.entitySet;
                    const oModel = this._getModelForEntityFromJsonModel(oJsonModel, sEntitySet);

                    if (!oModel) {
                        throw new Error(`OData 모델을 찾을 수 없습니다: ${sEntitySet}`);
                    }

                    // 해당 entitySet의 데이터를 식별하여 URI 생성
                    const sUri = this._createUriFromJsonModel(oJsonModel, sEntitySet, oDataToDelete);

                    // OData delete 요청을 비동기로 수행하여 Promise 배열에 추가
                    const promise = this._executeODataOperation(oModel, sUri, null, this.ODataOperationTypes.DELETE);

                    // 현재 Promise를 배열에 누적
                    return [...promises, promise]; // 누적된 Promise 배열 반환
                }, []); // 초기값을 빈 배열로 설정

                // 모든 삭제 요청이 완료될 때까지 기다림(대기)
                await Promise.all(aDeletionPromises);
                console.log("모든 데이터가 성공적으로 삭제되었습니다.");

            } catch (oError) {
                console.error("Error during combined delete operation:", oError);
            }
        }
    });
});