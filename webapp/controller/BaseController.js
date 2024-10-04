sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/Label",
    "sap/m/Input",
    "sap/base/util/deepClone",
    "sap/base/util/deepEqual",
    "sap/m/MessageBox",
	"sap/m/Column",
	"sap/m/ColumnListItem",
	"sap/m/Text",
	"sap/ui/model/json/JSONModel"
], function(
    Controller,
	Filter,
	FilterOperator,
	Label,
	Input,
	deepClone,
	deepEqual,
	MessageBox,
	Column,
	ColumnListItem,
	Text,
	JSONModel
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

        EntityRoleType : Object.freeze({
            PRIMARY: "primary",
            SUBORDINATE: "subordinate"
        }),

        CombindEntity: class {
            constructor(model, entitySetName, joinKeyPropertyName, role, propertyNames) {
                this.model = model;
                this.entitySetName = entitySetName;
                this.joinKeyPropertyName = joinKeyPropertyName;
                this.role = role;
                this.propertyNames = propertyNames;
            }
        
            // Getter를 사용하여 엔티티 세부 정보를 반환
            get entityDetails() {
                return {
                    model: this.model,
                    entitySetName: this.entitySetName,
                    joinKeyPropertyName: this.joinKeyPropertyName,
                    role: this.role,
                    propertyNames: this.propertyNames
                };
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

        // 주어진 이름의 엔티티 타입을 검색하는 함수
        _findEntityType: async function(oModel, sEntityTypeName) {
            const oMetadata = await this._getMetadataAsync(oModel);

            const oEntityType = oMetadata.dataServices.schema
                .flatMap(oSchema => oSchema.entityType)     // 모든 엔티티 타입 추출
                .find(entityType => entityType.name === sEntityTypeName); // 주어진 이름의 엔티티 타입 찾기

            if (!oEntityType) {
                throw new Error(`EntityType '${sEntityTypeName}' not found.`);
            }
            return oEntityType;
        },
        /**
         * 메타데이터에서 주어진 primaryEntity와 subordinateEntity 간의 외래 키 관계를 찾고,
         * NavigationProperty 이름을 반환하는 함수.
         * 
         * @param {Object} oModel - ODataModel 인스턴스
         * @param {String} primaryEntitySetName - 주 엔티티의 EntitySet 이름
         * @param {String} subordinateEntitySetName - 종속 엔티티의 EntitySet 이름
         * @returns {Promise<String>} - NavigationProperty 이름을 반환하는 Promise
         */
        _findForeignKeyRelationship: function(oModel, primaryEntitySetName, subordinateEntitySetName) {
            return new Promise((resolve, reject) => {
                // OData 모델에서 메타데이터를 비동기적으로 가져옴
                this._getMetadataAsync(oModel)
                    .then((oMetadata) => {
                        const schemas = oMetadata.dataServices.schema;

                        // 1. primaryEntitySetName에 해당하는 EntitySet 및 EntityType 찾기
                        // 모든 schema에서 EntitySet을 순회하여 primaryEntitySetName에 해당하는 EntitySet을 찾음
                        const primaryEntitySet = schemas.flatMap(schema => schema.entityContainer)
                            .flatMap(container => container.entitySet || [])
                            .find(entitySet => entitySet.name === primaryEntitySetName);

                        if(!primaryEntitySet) {
                            reject(`Primary EntitySet '${primaryEntitySetName}' not found in metadata.`);
                            return;
                        }

                        // EntitySet에서 entityType 속성 추출 (예: "ODataDemo.Product" -> "Product")
                        const primaryEntityTypeName = primaryEntitySet.entityType.split('.').pop();

                        // 추출한 entityType을 통해 해당 EntityType을 찾음
                        const primaryEntityType = schemas.flatMap(schema => schema.entityType)
                            .find(entityType => entityType.name === primaryEntityTypeName);

                        if(!primaryEntityType) {
                            reject(`EntityType '${primaryEntityTypeName}' for EntitySet '${primaryEntitySetName}' not found in metadata.`);
                            return;
                        }

                        // 2. NavigationProperty를 통해 subordinateEntitySetName과 관계가 있는지 확인
                        // primaryEntityType에서 navigationProperty를 찾아서 관계가 있는지 확인
                        const navigationProperty = primaryEntityType.navigationProperty
                            .find(navProp => {
                                // NavigationProperty가 참조하는 Association을 찾음
                                const associationName = navProp.relationship.split('.').pop();  // Association 이름 추출
                                
                                // 해당 Association을 메타데이터에서 찾음
                                const association = schemas.flatMap(schema => schema.association || [])
                                    .find(assoc => assoc.name === associationName);

                                if(!association) {
                                    return false;
                                }

                                // Association의 End 요소에서 subordinateEntitySetName에 해당하는 엔티티와 Role을 찾음
                                const relatedEntitySet = schemas.flatMap(schema => schema.entityContainer)
                                    .flatMap(container => container.entitySet || [])
                                    .find(entitySet => entitySet.name === subordinateEntitySetName);

                                if(!relatedEntitySet) {
                                    return false;
                                }

                                const relatedEntityTypeName = relatedEntitySet.entityType.split('.').pop();

                                // Association의 End에서 관련된 엔티티와 Role을 확인
                                const relatedEnd = association.end.find(end => end.type.includes(relatedEntityTypeName));

                                return relatedEnd && relatedEnd.role === navProp.toRole;
                            });
                        
                        // 관계가 없으면 reject 처리
                        if(!navigationProperty) {
                            reject(`No NavigationProperty found between '${primaryEntitySetName}' and '${subordinateEntitySetName}'.`);
                            return;
                        }

                        // 3. 관계가 있으면 NavigationProperty의 이름을 resolve로 반환
                        resolve(navigationProperty.name);
                    }).catch((error) => reject(error));
            });
        },

        /**
         * 주어진 엔티티들 간의 데이터를 결합하여 테이블에 바인딩하는 함수
         * 
         * @param {Array} combinedEntities - 주 엔티티 및 종속 엔티티들의 배열
         */
        loadCombinedEntitiesV0: async function(...combinedEntities) {
            // main 1, sub n 개수 체크 (주 엔티티는 하나만 허용)
            const primaryEntityCount = combinedEntities.filter((combindEntity) => combindEntity.entityDetails.role === this.EntityRoleType.PRIMARY).length;
            if (primaryEntityCount > 1) {
                throw new Error("primary entity가 2개 이상 존재합니다.");
            } else if (primaryEntityCount < 1) {
                throw new Error("primary entity가 존재하지 않습니다.");
            }
            
            // 주 엔티티 찾기
            const primaryEntity = combinedEntities.find((entity) => entity.entityDetails.role === this.EntityRoleType.PRIMARY);

            // 서브 엔티티들 찾기
            const subordinateEntities = combinedEntities.filter((entity) => entity.entityDetails.role === this.EntityRoleType.SUBORDINATE);
        
            // 외래키 관계 여부 체크 및 $expand를 위한 URL 파라미터 준비
            const expandParams = [];
        
            // 서브 엔티티가 존재할 경우 외래 키 관계를 확인하고 $expand 파라미터 준비
            if (subordinateEntities.length > 0) {
                console.log(`subordinateEntities exists and start expand reading`);
                
                // URL 파라미터 작성을 위한 객체
                const urlParameters = {};
                
                // 각 서브 엔티티에 대해 주 엔티티와 외래키 관계가 있는지 확인
                for (let subordinateEntity of subordinateEntities) {
                    const primaryJoinKeyName = primaryEntity.entityDetails.joinKeyPropertyName;
                    const subordinateJoinKeyName = subordinateEntity.entityDetails.joinKeyPropertyName;
        
                    // 외래키 관계 확인 (메타데이터에서 관계를 찾음)
                    const foreignKeyRelationship = await this._findForeignKeyRelationship(
                        primaryEntity.entityDetails.model, 
                        primaryEntity.entityDetails.entitySetName, 
                        subordinateEntity.entityDetails.entitySetName
                    );

                    // 관계가 있을 경우 $expand 파라미터에 navigationProperty 이름을 추가
                    if(foreignKeyRelationship) {
                        expandParams.push(foreignKeyRelationship);
                    } else {
                        throw new Error(`Subordinate entity '${subordinateEntity.entityDetails.entitySetName}' does not have a foreign key relationship with the primary entity.`);
                    }

                }
        
                // OData 읽기 URL 파라미터로 $expand 사용
                if (expandParams.length > 0) {
                    urlParameters.$expand = expandParams.join(',');
                }
            }
        
            // 테이블 모델 설정 (주 엔티티의 모델 사용)
            const table = this.getView().byId("main_table");
            table.setModel(primaryEntity.entityDetails.model, "tableModel");
        
            // 테이블의 기존 컬럼을 모두 삭제
            table.removeAllColumns();
        
            // 주 엔티티의 각 속성에 대해 동적으로 컬럼 추가
            primaryEntity.entityDetails.propertyNames.forEach((propertyName) => {
                const column = new Column({
                    header: new sap.m.Label({text: propertyName}) // 컬럼 헤더 설정
                });
                table.addColumn(column);
            });

            // 서브 엔티티의 속성에 대해 컬럼 추가 및 데이터 바인딩
            subordinateEntities.forEach((subordinateEntity, index) => {
                const navigationPropertyName = expandParams[index]; // 해당 서브 엔티티의 NavigationPropertyName

                subordinateEntity.entityDetails.propertyNames.forEach((subPropertyName) => {
                    const column = new Column({
                        header: new Label({text: `${navigationPropertyName}_${subPropertyName}`}) // 서브 엔티티의 컬럼 헤더 설정
                    });
                    table.addColumn(column);
                });
            });
        
            // 테이블 아이템에 데이터 바인딩 (ODataModel에서 바로 바인딩)
            table.bindItems({
                path: `tableModel>/${primaryEntity.entityDetails.entitySetName}`,
                parameters: {
                    expand: expandParams.join(',') // 서브 엔티티의 NavigationProperty를 expand
                },
                template: new ColumnListItem({
                    cells: [
                        // 주 엔티티의 속성에 대한 데이터 바인딩
                        ...primaryEntity.entityDetails.propertyNames.map(propertyName => new Text({text: `{tableModel>${propertyName}}`})),
                        // 서브 엔티티의 속성에 대한 데이터 바인딩
                        ...subordinateEntities.flatMap((subordinateEntity, index) => {
                            const navigationPropertyName = expandParams[index]; // 해당 서브 엔티티의 NavigationPropertyName
                            return subordinateEntity.entityDetails.propertyNames.map(
                                subPropertyName => new Text({text: `{tableModel>${navigationPropertyName}/${subPropertyName}}`}) // 서브 엔티티의 속성을 navigationPropertyName/subProperty로 바인딩
                            );
                        })
                    ]
                })
            });
        },

        /**
         * 메타데이터에서 주어진 primaryEntity와 subordinateEntity 간의 외래 키 관계를 찾고,
         * NavigationProperty 이름을 반환하는 함수.
         * 
         * @param {Object} oModel - ODataModel 인스턴스
         * @param {String} primaryEntitySetName - 주 엔티티의 EntitySet 이름
         * @param {String} subordinateEntitySetName - 종속 엔티티의 EntitySet 이름
         * @returns {Promise<String>} - NavigationProperty 이름을 반환하는 Promise
         */
        loadCombinedEntitiesV1: async function(...combinedEntities) {
            // 주 엔티티와 서브 엔티티의 수를 검증
            const primaryEntity = this._validateEntitiesAndFindPrimaryEntity(combinedEntities);

            // 서브 엔티티들 찾기
            const subordinateEntities = combinedEntities.filter((entity) => entity.entityDetails.role === this.EntityRoleType.SUBORDINATE);

            // 외래 키 관계 및 $expand 파라미터 준비
            const expandParams = await this._prepareExpandParams(primaryEntity, subordinateEntities);

            // 테이블 설정 및 바인딩 처리
            this._setupTable(primaryEntity, subordinateEntities, expandParams);
        },

        /**
         * 주어진 엔티티 배열에서 주 엔티티를 검증 및 반환
         */
        _validateEntitiesAndFindPrimaryEntity: function(combinedEntities) {
            const primaryEntityCount = combinedEntities.filter((combindEntity) => combindEntity.entityDetails.role === this.EntityRoleType.PRIMARY).length;
            if (primaryEntityCount > 1) {
                throw new Error("primary entity가 2개 이상 존재합니다.");
            } else if (primaryEntityCount < 1) {
                throw new Error("primary entity가 존재하지 않습니다.");
            }
            
            // 주 엔티티 찾기
            return combinedEntities.find((entity) => entity.entityDetails.role === this.EntityRoleType.PRIMARY);            
        },

        /**
         * 주 엔티티와 서브 엔티티 간의 외래 키 관계를 확인하고 $expand 파라미터를 준비
         */
        _prepareExpandParams: async function(primaryEntity, subordinateEntities) {
            const expandParams = [];
            if (subordinateEntities.length > 0) {
                console.log("subordinateEntities exists and start expand reading");

                for (let subordinateEntity of subordinateEntities) {
                    const foreignKeyRelationship = await this._findForeignKeyRelationship(
                        primaryEntity.entityDetails.model,
                        primaryEntity.entityDetails.entitySetName,
                        subordinateEntity.entityDetails.entitySetName
                    );

                    if (foreignKeyRelationship) {
                        expandParams.push(foreignKeyRelationship);
                    } else {
                        throw new Error(`Subordinate entity '${subordinateEntity.entityDetails.entitySetName}' does not have a foreign key relationship with the primary entity.`);
                    }
                }
            }
            return expandParams;
        },
        
        /**
         * 테이블 설정 및 컬럼, 데이터 바인딩 처리
         */
        _setupTable: function(primaryEntity, subordinateEntities, expandParams) {
            const table = this.getView().byId("main_table");
            table.setModel(primaryEntity.entityDetails.model, "tableModel");

            // 테이블의 기존 컬럼을 모두 삭제
            table.removeAllColumns();

            // 컬럼 추가 함수
            const addColumn = (headerText) => {
                table.addColumn(new sap.m.Column({
                    header: new sap.m.Label({ text: headerText })
                }));
            };

            // 주 엔티티 컬럼 추가
            primaryEntity.entityDetails.propertyNames.forEach(addColumn);

            // 서브 엔티티 컬럼 추가
            subordinateEntities.forEach((subordinateEntity, index) => {
                const navigationPropertyName = expandParams[index];
                subordinateEntity.entityDetails.propertyNames.forEach((subPropertyName) => {
                    addColumn(`${navigationPropertyName}_${subPropertyName}`);
                });
            });

            // 테이블 아이템에 데이터 바인딩 (ODataModel에서 바로 바인딩)
            table.bindItems({
                path: `tableModel>/${primaryEntity.entityDetails.entitySetName}`,
                parameters: {
                    expand: expandParams.join(',')
                },
                template: new sap.m.ColumnListItem({
                    cells: [
                        // 주 엔티티 속성 바인딩
                        ...primaryEntity.entityDetails.propertyNames.map(propertyName => new sap.m.Text({ text: `{tableModel>${propertyName}}` })),
                        // 서브 엔티티 속성 바인딩
                        ...subordinateEntities.flatMap((subordinateEntity, index) => {
                            const navigationPropertyName = expandParams[index];
                            return subordinateEntity.entityDetails.propertyNames.map(subPropertyName => 
                                new sap.m.Text({ text: `{tableModel>${navigationPropertyName}/${subPropertyName}}` })
                            );
                        })
                    ]
                })
            });
        },
        
        /**
         * 주어진 엔티티들 간의 데이터를 결합하여 테이블에 바인딩하는 함수
         * 
         * @param {Array} combinedEntities - 주 엔티티 및 종속 엔티티들의 배열
         */
        loadCombinedEntitiesV2: async function(...combinedEntities) {
            // main 1, sub n 개수 체크 (주 엔티티는 하나만 허용)
            const primaryEntityCount = combinedEntities.filter((combindEntity) => combindEntity.entityDetails.role === this.EntityRoleType.PRIMARY).length;
            if (primaryEntityCount > 1) {
                throw new Error("primary entity가 2개 이상 존재합니다.");
            } else if (primaryEntityCount < 1) {
                throw new Error("primary entity가 존재하지 않습니다.");
            }
            
            // 주 엔티티 찾기
            const primaryEntity = combinedEntities.find((entity) => entity.entityDetails.role === this.EntityRoleType.PRIMARY);
        
            // 서브 엔티티들 찾기
            const subordinateEntities = combinedEntities.filter((entity) => entity.entityDetails.role === this.EntityRoleType.SUBORDINATE);
        
            // 외래키 관계가 있는 엔티티셋과 없는 엔티티셋을 분리
            const foreignKeyEntities = [];
            const nonForeignKeyEntities = [];
        
            for (let subordinateEntity of subordinateEntities) {
                try {
                    // 외래키 관계 여부를 확인하고 외래키가 있으면 foreignKeyEntities로 이동
                    const foreignKeyRelationship = await this._findForeignKeyRelationship(
                        primaryEntity.entityDetails.model,
                        primaryEntity.entityDetails.entitySetName,
                        subordinateEntity.entityDetails.entitySetName
                    );
        
                    if (foreignKeyRelationship) {
                        foreignKeyEntities.push({
                            entity: subordinateEntity,
                            foreignKeyRelationship
                        });
                    } else {
                        throw new Error();
                    }
                } catch (error) {
                    // 외래키 관계가 없으면 nonForeignKeyEntities로 이동
                    nonForeignKeyEntities.push(subordinateEntity);
                }
            }
        
            // 외래키 관계가 있는 엔티티셋 먼저 $expand로 처리
            const expandParams = [];
            if (foreignKeyEntities.length > 0) {
                foreignKeyEntities.forEach(foreignKeyEntity => {
                    expandParams.push(foreignKeyEntity.foreignKeyRelationship);
                });
            }
        
            // $expand를 처리할 URL 파라미터 설정
            const urlParameters = expandParams.length > 0 ? { $expand: expandParams.join(',') } : {};
        
            // 메인 엔티티셋 데이터를 $expand로 읽음
            let primaryEntityData = await this._readODataAsync(primaryEntity.entityDetails.model, primaryEntity.entityDetails.entitySetName, urlParameters);
        
            let mergedData = primaryEntityData.results;
        
            // 외래키 관계가 없는 엔티티셋 처리 (수평적 병합)
            if (nonForeignKeyEntities.length > 0) {
                console.log("Processing non-foreign key entities with horizontal merging.");
        
                for (let nonForeignKeyEntity of nonForeignKeyEntities) {
                    const subordinateData = await this._readODataAsync(
                        nonForeignKeyEntity.entityDetails.model,
                        nonForeignKeyEntity.entityDetails.entitySetName,
                        {}
                    );
        
                    // joinKeyProperty를 이용해 JSONModel 데이터 재구성 (메인 엔티티에 서브 엔티티 데이터를 포함시킴)
                    mergedData = this._transformToExpandedStructure(
                        mergedData,
                        subordinateData.results,
                        nonForeignKeyEntity.entityDetails.entitySetName, // NavigationPropertyname
                        primaryEntity.entityDetails.joinKeyPropertyName, // Primary key
                        nonForeignKeyEntity.entityDetails.joinKeyPropertyName // Subordinate key
                    );
                }
            }
        
            // 모든 엔티티셋이 외래 키 관계가 설정된 경우 ODataModel을 그대로 테이블에 바인딩
            const allEntitiesHaveForeignKey = nonForeignKeyEntities.length === 0;
        
            // 테이블에 사용할 모델 설정
            const table = this.getView().byId("main_table");
            if (allEntitiesHaveForeignKey) {
                // ODataModel 설정
                table.setModel(primaryEntity.entityDetails.model, "tableModel");
            } else {
                // 병합된 데이터를 JSONModel로 설정
                const oJSONModel = new JSONModel(mergedData);
                table.setModel(oJSONModel, "tableModel");
            }
        
            // 테이블의 기존 컬럼을 모두 삭제
            table.removeAllColumns();
        
            // 주 엔티티 컬럼 추가
            primaryEntity.entityDetails.propertyNames.forEach((propertyName) => {
                const column = new Column({
                    header: new Label({ text: propertyName }) // 주 엔티티 컬럼 헤더 설정
                });
                table.addColumn(column);
            });
        
            // 서브 엔티티 컬럼 추가 및 데이터 바인딩
            subordinateEntities.forEach((subordinateEntity, index) => {
                const navigationPropertyName = expandParams[index] || subordinateEntity.entityDetails.entitySetName; // 관계가 없을 경우 서브 엔티티 이름 사용
        
                subordinateEntity.entityDetails.propertyNames.forEach((subPropertyName) => {
                    const column = new Column({
                        header: new Label({ text: `${navigationPropertyName}_${subPropertyName}` }) // 서브 엔티티 컬럼 헤더 설정
                    });
                    table.addColumn(column);
                });
            });
        
            // 테이블 아이템에 데이터 바인딩
            table.bindItems({
                path: allEntitiesHaveForeignKey ? `tableModel>/${primaryEntity.entityDetails.entitySetName}` : "tableModel>/",  // 모델에 따라 path 설정
                template: new ColumnListItem({
                    cells: [
                        // 주 엔티티의 속성에 대한 데이터 바인딩
                        ...primaryEntity.entityDetails.propertyNames.map(propertyName => new Text({ text: `{tableModel>${propertyName}}` })),
                        // 서브 엔티티의 속성에 대한 데이터 바인딩 (NavigationPropertyName 포함)
                        ...subordinateEntities.flatMap((subordinateEntity, index) => {
                            const navigationPropertyName = allEntitiesHaveForeignKey ? expandParams[index] : subordinateEntity.entityDetails.entitySetName; // NavigationPropertyName은 엔티티셋 이름으로 설정
                            return subordinateEntity.entityDetails.propertyNames.map(
                                subPropertyName => new Text({ text: `{tableModel>${navigationPropertyName}/${subPropertyName}}` }) // ODataModel과 JSONModel 동일한 바인딩 경로 사용
                            );
                        })
                    ]
                })
            });
        },
        
        /**
         * 주 엔티티셋과 서브 엔티티셋 데이터를 NavigationPropertyname 하위에 포함시켜 확장된 구조로 변환하는 함수
         * joinKeyProperty가 없을 경우 순차적으로 병합
         */
        _transformToExpandedStructure: function(primaryData, subordinateData, navigationPropertyName, joinKeyPrimary, joinKeySubordinate) {
            return primaryData.map((primaryItem, index) => {
                // joinKeyProperty가 있는 경우 키를 기준으로 병합
                if (joinKeyPrimary && joinKeySubordinate) {
                    const matchingSubordinateItem = subordinateData.find(subordinateItem => subordinateItem[joinKeySubordinate] === primaryItem[joinKeyPrimary]);
                    return {
                        ...primaryItem,
                        [navigationPropertyName]: matchingSubordinateItem || {} // 일치하는 서브 엔티티 데이터가 없을 경우 빈 객체로 추가
                    };
                } else {
                    // joinKeyProperty가 없을 경우 순차적으로 병합
                    const subordinateItem = subordinateData[index] || {};
                    return {
                        ...primaryItem,
                        [navigationPropertyName]: subordinateItem // 순차적으로 병합
                    };
                }
            });
        },

        /**
         * 주 엔티티와 서브 엔티티 데이터를 joinKeyProperty를 기반으로 병합하는 함수.
         * 관계가 없는 경우 순차적으로 병합.
         */
        _mergeEntitiesByJoinKey: function(primaryData, subordinateData, primaryKey, subordinateKey) {
            if (primaryKey && subordinateKey) {
                // joinKeyProperty를 기반으로 두 엔티티 병합
                return primaryData.map((primaryItem, index) => {
                    const matchingSubItem = subordinateData.find(subItem => subItem[subordinateKey] === primaryItem[primaryKey]);
                    return {
                        ...primaryItem,
                        ...(matchingSubItem || {}) // 키가 일치하는 서브 엔티티 항목이 있으면 병합
                    };
                });
            } else {
                // joinKeyProperty가 없을 경우 순차적으로 병합
                return primaryData.map((primaryItem, index) => ({
                    ...primaryItem,
                    ...(subordinateData[index] || {}) // 순차적으로 서브 엔티티 데이터 병합
                }));
            }
        },

        /**
         * 메인 엔티티셋의 데이터 수에 맞게 서브 엔티티 데이터를 조정하는 함수.
         */
        _adjustToMainEntityCount: function(mainEntityData, mergedData) {
            const mainEntityCount = mainEntityData.length;
            return mergedData.slice(0, mainEntityCount); // 메인 엔티티셋의 데이터 수에 맞게 자르기
        }        
    });
});