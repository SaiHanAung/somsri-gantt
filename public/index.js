import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import {
    getDatabase,
    set,
    ref,
    update,
    onValue
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

const c = console.log.bind();
const firebaseConfig = {
    apiKey: "AIzaSyCKxEYUtxMrevfSLSRHKUHc7gKTSKBZ-Vg",
    authDomain: "somsritshirt-ced49.firebaseapp.com",
    databaseURL: "https://somsritshirt-ced49.firebaseio.com",
    projectId: "somsritshirt-ced49",
    storageBucket: "somsritshirt-ced49.appspot.com",
    messagingSenderId: "99816736698",
    appId: "1:99816736698:web:a5fb5f8f10194c8221ff83"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const database = getDatabase(app);
const { createApp } = Vue
let oldToken

const vm = createApp({
    data() {
        return {
            projectGroups: [],
            viewProject: {},
            searchField: '',
            searchFieldValue: {
                label: '',
                value: ''
            },
            fieldSelected: null,
            fieldOptions: [],
            data: null,
            gantts: null,
            ganttGroup: [],
            tabActive: null,
            event: null,
            loading: true,
            isLoggedIn: false,
            user: {},
            toast: Swal.mixin({
                toast: true,
                position: "top-end",
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.onmouseenter = Swal.stopTimer;
                    toast.onmouseleave = Swal.resumeTimer;
                }
            }),
            filters: [],
        };
    },
    methods: {
        resetUserInput() {
            this.user = {}
        },
        checkOldToken() {
            if (oldToken) {
                this.user.airtable_token = oldToken
            }
        },
        signOut() {
            signOut(auth)
            this.user = {};
            this.isLoggedIn = false
        },
        closeModal(modalId) {
            document.getElementById(modalId).close();
        },
        setting(modalId) {
            if (!this.user.verify_token) {
                return this.toast.fire({
                    icon: "warning",
                    title: "ตรวจสอบ Token ก่อน"
                });
            }

            update(ref(database, `gantts/users/${this.user.uid}`), {
                airtable_token: this.user.airtable_token
            })
                .then(() => {
                    this.closeModal(modalId);
                })
                .catch((err) => {
                    console.error(err)
                    this.toast.fire({
                        icon: "error",
                        title: "เกิดปัญหาบางอย่างที่ setting() > update()"
                    });
                })
        },
        async verifyToken() {
            if (!this.user.airtable_token) {
                return this.toast.fire({
                    icon: "warning",
                    title: "กรอก Token ก่อน"
                });
            }

            const header = {
                headers: {
                    Authorization: `Bearer ${this.user.airtable_token}`
                }
            }
            try {
                const resp = await axios.get('https://api.airtable.com/v0/meta/whoami', header)

                if (resp.data.id) {
                    this.user.verify_token = true
                    return
                }
            }
            catch (err) {
                if (oldToken) {
                    this.user.airtable_token = oldToken
                }
                this.toast.fire({
                    icon: "error",
                    title: "Token ไม่ถูกต้อง ไม่สามารถเชื่อมต่อด้วย Token นี้ได้"
                });
                console.error(err)
            }
        },
        register(modalId) {
            createUserWithEmailAndPassword(auth, this.user.email, this.user.password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    this.gantts = []
                    this.toast.fire({
                        icon: "warning",
                        title: "หลังจากสมัครบัญชีแล้วให้ไปกรอก Token ก่อนจึงจะดู Ganttได้"
                    });

                    set(ref(database, 'gantts/users/' + user.uid), {
                        email: user.email,
                        airtable_token: 0
                    }).catch((err) => {
                        console.error(err)
                        this.toast.fire({
                            icon: "error",
                            title: "เกิดปัญหาบางอย่างที่ register() > set()"
                        });
                    });

                    this.closeModal(modalId);
                })
                .catch((err) => {
                    if (err.customData._tokenResponse.error.message == 'EMAIL_EXISTS') {
                        return this.toast.fire({
                            icon: "warning",
                            title: "Email นี้ถูกใช้ไปแล้ว"
                        });
                    }
                    this.toast.fire({
                        icon: "error",
                        title: "เกิดปัญหาบางอย่างที่ register()"
                    });
                    console.error(err)
                });
        },
        async fetchUserData() {
            const starCountRef = ref(database, `gantts/users/${this.user.uid}`);
            await onValue(starCountRef, (snapshot) => {
                Object.assign(this.user, snapshot.val())
                if (snapshot.val().airtable_token != 0) {
                    oldToken = snapshot.val().airtable_token
                    this.getGantt();
                } else {
                    this.isLoaded();
                }
            })
        },
        login(modalId) {
            this.isLoading();
            signInWithEmailAndPassword(auth, this.user.email, this.user.password).then((userCredential) => {
                this.user.err = null
                this.closeModal(modalId);
                this.user.email = userCredential._tokenResponse.email
                this.user.password = ""

                this.fetchUserData();
            }).catch(() => {
                this.isLoaded();
                this.user.err = "อีเมลหรือรหัสผ่านผิด"
            })
        },
        async checkAuth() {
            this.isLoading();
            await onAuthStateChanged(auth, (user) => {
                if (user) {
                    this.user = user
                    this.isLoggedIn = true
                    this.fetchUserData();
                } else {
                    this.isLoaded();
                }
            });
        },
        isLoading() {
            this.loading = true;
        },
        isLoaded() {
            this.loading = false;
        },
        getGantt() {
            axios(
                "https://api.airtable.com/v0/appjfqpEHmnEsozi9/tbl64GrdfhsMbqiJ0",
                {
                    headers: `Authorization: Bearer ${this.user.airtable_token}`,
                }
            )
                .then((el) => {
                    const ganttGroup = [];
                    el.data.records.forEach((d) => {
                        if (
                            d.fields.base_id &&
                            ganttGroup.findIndex((g) => g.base_id == d.fields.base_id) <
                            0
                        ) {
                            ganttGroup.push({
                                base_id: d.fields.base_id,
                                base_name: d.fields.base_name,
                                tables: []
                            });
                        }

                        ganttGroup.forEach((gg) => {
                            if (
                                gg.tables.findIndex(
                                    (tb) => tb.table_id == d.fields.table_id
                                ) < 0
                            ) {
                                gg.tables.push({
                                    table_id: d.fields.table_id,
                                    table_name: d.fields.table_name,
                                    table_sort: d.fields.table_sort,
                                    views: [],
                                });
                            }

                            gg.tables.forEach((tb) => {
                                if (
                                    tb.views.findIndex(
                                        (tb) => tb.button_name == d.fields.button_name
                                    ) < 0 && tb.table_id == d.fields.table_id
                                ) {
                                    const mergeObj = Object.assign({}, { record_id: d.id }, d.fields)
                                    if (this.tabActive?.record_id == d.id) this.tabActive = mergeObj
                                    tb.views.push(mergeObj);
                                }
                            });
                        });
                    });
                    this.gantts = ganttGroup;
                    this.isLoaded();
                })
                .catch((err) => {
                    this.toast.fire({
                        icon: "error",
                        title: "เกิดปัญหาบางอย่างขึ้นที่ getGantt()"
                    });
                    console.error(err);
                });
        },
        async showGantt(g) {
            const url = `https://api.airtable.com/v0/${g.base_id}/${g.table_id}`
            const header = {
                headers: `Authorization: Bearer ${this.user.airtable_token}`,
            }

            if (!g) return
            this.tabActive = g;
            this.isLoading();

            // Get table data
            try {
                const fetchAll = async () => {
                    const response = []

                    while (1) {
                        const result = await axios(response.length > 0 ? `${url}/?offset=${response[response.length - 1].offset}` : url, header)
                        response.push(result.data)
                        if (!result.data.offset) break;
                    }
                    return response.map(res => res.records).reduce((acc, curr) => {
                        return acc.concat(curr);
                    }, [])
                }

                const getAllResponse = await Promise.all([fetchAll()])

                let groupBy
                this.data = getAllResponse[0].filter(record => record.fields[g.field_start || g.field_name])
                    .map((d) => {
                        const projectName = d.fields[g.field_name];
                        const blockStart = d.fields[g.field_start];
                        const blockEnd = d.fields[g.field_end];
                        let groupSort = g.group_sort;
                        if (groupSort) {
                            let groupArr = groupSort.split(',');
                            Object.entries(groupArr).map((group, index) => {
                                if (d.fields[g.field_group] == group[1]) {
                                    groupBy = `${index + 1}. ${group[1]}`
                                    // groupBy = `${group[1]}`
                                }
                            })
                        }

                        Object.keys(d.fields).map(field => {
                            if (this.fieldOptions.findIndex(val => val == field) == -1) {
                                this.fieldOptions.push(field)
                            }
                        })

                        return {
                            id: d.id,
                            title: projectName,
                            groupBy: groupBy || d.fields[g.field_group] || null,
                            resourceId: d.id,
                            start: blockStart ? `${blockStart} 08:00:00` : '',
                            end: blockEnd ? `${blockEnd} 17:00:00` : '',
                            fields: d.fields
                        };
                    });

                this.isLoaded();
                this.renderCalendar();
            } catch (err) {
                this.toast.fire({
                    icon: "error",
                    title: "เกิดข้อผิดพลาดระหว่างดึงข้อมูล at showGantt()"
                });
                console.error(err);
            }

            // Get detail for field type
            axios(`https://api.airtable.com/v0/meta/bases/${g.base_id}/tables`, {
                headers: `Authorization: Bearer ${this.user.airtable_token}`,
            }).then((el) => {
                this.tabActive.fieldType = el.data.tables.filter((table) => table.id === g.table_id).map(tb => tb.fields)[0]
            }).catch((err) => {
                this.toast.fire({
                    icon: "error",
                    title: "เกิดข้อผิดพลาดระหว่างดึงข้อมูล Meta data at showGantt()"
                });
                console.error(err);
            });
        },
        renderCalendar() {
            let clickCnt = 0
            let calendarEl = document.getElementById("calendar");
            let calendar = new FullCalendar.Calendar(calendarEl, {
                height: this.windowResize(),
                schedulerLicenseKey: "GPL-My-Project-Is-Open-Source",
                timeZone: "UTC",
                initialView: "resourceTimelineMonth",
                aspectRatio: 1.5,
                headerToolbar: {
                    left: "today prev,next",
                    center: "title",
                    right:
                        "resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth",
                },
                buttonText: {
                    today: "วันนี้",
                    day: "รายวัน",
                    week: "รายสัปดาห์",
                    month: "รายเดือน",
                },
                slotMinTime: "08:00:00",
                slotMaxTime: "18:00:00",
                editable: this.tabActive?.button_name.includes('ALL TEAM') ? false : true,
                resources: this.tabActive?.button_name.includes('ALL TEAM') ? this.filteredAllTeamResorce : this.filteredData,
                resourceAreaHeaderContent: {
                    html: `<div class="flex items-center gap-1">
                            ${vm.tabActive?.button_name ? `<small class="px-1 btn btn-sm btn-ghost ${vm.filters.length > 0 ? 'bg-[#a52241] hover:bg-rose-900 text-white' : ''}" onclick="filter_modal.showModal()"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" /></svg></small>` : ''}
                            <span>${vm.tabActive?.button_name || "ชื่อโปรเจกต์"}</span>
                        </div>
                        `
                },
                resourceLabelContent: function (info) {
                    const sliceDate = (start, end) => {
                        if (!start || !end) return ''
                        const thaiDate = (date) => {
                            const arrDate = new Date(date).toLocaleDateString('th').split("/")
                            return `${arrDate[0]}/${arrDate[1]}`
                        }
                        return ` 📅 ${thaiDate(start)} ถึง ${thaiDate(end)}`
                    }
                    const { start, end, fields } = info.resource._resource.extendedProps
                    const initHtml = () => {
                        if (vm.tabActive.table_name.includes('MASTER')) {
                            return `${info.resource?.title} <small class="text-[#a52241]">${sliceDate(start, end)}</small>`
                        } else {
                            return `<small>#${fields[vm.tabActive.field_prefix]}</small><br><p class="indent-4">${info.resource?.title} <small class="text-[#a52241]">${sliceDate(start, end)}</small></p>`
                        }
                    }

                    return { html: initHtml() }
                },
                resourceOrder: "groupBy,start",
                resourceGroupField: 'groupBy',
                displayEventTime: false,
                events: this.tabActive?.button_name.includes('ALL TEAM') ? this.filteredAllTeamEvents : this.filteredData,
                eventColor: "#a52241",
                eventBorderColor: '#fff',
                eventClick: function (info) {
                    if (vm.tabActive.table_name.includes('MASTER')) {
                        clickCnt++
                        if (clickCnt === 1) {
                            setTimeout(function () {
                                clickCnt = 0
                            }, 400)
                        } else if (clickCnt === 2) {
                            clickCnt = 0
                            const { title, extendedProps: props } = info.event
                            vm.viewProject.name = title
                            vm.viewProject.fields = props.fields
                            const modalId = document.getElementById('project_gantt')
                            modalId.showModal()
                            vm.renderProjectCalendar();
                        }
                    }
                },
                eventResize: async function (info) {
                    const { startStr, endStr, id, title } = info.event;
                    const startStrOld = info.oldEvent.startStr;
                    const endStrOld = info.oldEvent.endStr;
                    vm.event = {
                        id: id,
                        name: title,
                        start: startStr,
                        end: endStr,
                    };

                    if (!vm.tabActive.field_end) {
                        if (startStrOld != startStr) {
                            vm.toast.fire({
                                icon: "warning",
                                title: "ไม่มีข้อมูลของวันที่จบ(field_end) จึงทำให้แท่งกราฟอิงตามวันที่เริ่ม(field_start)"
                            });
                            await vm.updateRecords();
                        } else if (endStrOld != endStr) {
                            info.revert();
                            return vm.toast.fire({
                                icon: "error",
                                title: "ไม่สามารถ Update ได้เนื่องจากไม่มีข้อมูลของวันที่จบ(field_end)"
                            });
                        }
                    } else {
                        await vm.updateRecords();
                    }
                },
                eventDrop: function (info) {
                    const { startStr, endStr, id, title } = info.event;
                    vm.event = {
                        id: id,
                        name: title,
                        start: startStr,
                        end: endStr,
                    };

                    vm.updateRecords();
                },
                eventContent: function (info) {
                    const { fields, groupBy } = info.event.extendedProps
                    const fieldCount = vm.tabActive.field_count
                    const start = new Date(info.event.start).getDate()
                    const startTime = new Date(info.event.start).getTime()
                    const dueDateTime = new Date(fields?.[vm.tabActive?.field_duedate]).getTime()
                    const status = fields?.[vm.tabActive.field_status]
                    const eventName = `${fields?.[vm.tabActive.field_eventName]}) ${groupBy?.split(". ")[1] || groupBy}`

                    function setTooltipPosition() {
                        if (start) {
                            if ([1, 2].includes(start)) return 'right'
                            else if ([29, 30, 31].includes(start)) return 'left'
                            else return 'top'
                        }
                    }

                    function setBg() {
                        if (startTime < dueDateTime) {
                            if (status?.includes('กำลัง')) return 'bg-yellow-500'
                            else if (status?.includes('เสร็จสิ้น')) return 'bg-green-500'
                            else return 'bg-neutral-500 border-neutral-500'
                        } else {
                            // if (status?.includes('เสร็จสิ้น')) return 'bg-green-500'
                            return 'bg-red-500'
                        }
                    }

                    function setTooltip() {
                        return `tooltip tooltip-${setTooltipPosition()} ${setBg()}`
                    }

                    function initHtml() {
                        return fields[fieldCount] ? `
                        <div class="flex flex-nowrap ${setTooltip()} ring-2 ring-slate-500 ring-offset-2 outline-dotted outline-2 outline-offset-2" data-tip="${fieldCount} : ${fields[fieldCount]} #สถานะ : ${status}"><span class="truncate">${eventName || undefined}</span></div>
                    ` : `<div class="flex flex-nowrap cursor-default ring-2 ring-current ${setTooltip()}" data-tip="#สถานะ : ${status}"><span class="truncate">${eventName || undefined}</span></div>`
                    }

                    return {
                        html:
                            !vm.tabActive.table_name.includes('MASTER')
                                ? initHtml()
                                : `<div class="flex flex-nowrap"><span class="truncate">${info.event.title}</span></div>`
                    }

                },
                slotLabelContent: function (info) {
                    const data = vm.filteredData?.filter(f => new Date(f.start).getDate() === new Date(info.date).getDate())
                    const sumAmount = data?.reduce((acc, curr) => acc + (curr.fields[vm.tabActive.field_count] || 0), 0)

                    return {
                        html: `
                        <div class="gird text-center">
                            <p>${info.text}</p>
                            ${sumAmount ? `<small class="font-normal tooltip" data-tip="ยอดสั่งงาน">ยอด ${sumAmount || 0}</small>` : '&nbsp;'}
                        </div>
                    ` }
                }
            });

            calendar.setOption("locale", "th");
            calendar.render();
            setTimeout(() => {
                calendar.prev();
                calendar.next();
            }, 200);

            const spans = document.querySelectorAll('span.fc-datagrid-expander-placeholder');
            spans.forEach(span => {
                span.classList.add('hidden');
            });
        },
        renderProjectCalendar() {
            let calendarEl = document.getElementById("project_calendar");
            let calendar = new FullCalendar.Calendar(calendarEl, {
                height: this.projectModalsize(),
                schedulerLicenseKey: "GPL-My-Project-Is-Open-Source",
                timeZone: "UTC",
                initialView: "resourceTimelineMonth",
                aspectRatio: 1.5,
                headerToolbar: {
                    left: "today prev,next",
                    center: "title",
                    right: "",
                },
                buttonText: {
                    today: "วันนี้"
                },
                slotMinTime: "08:00:00",
                slotMaxTime: "18:00:00",
                // editable: true,
                resources: this.filteredProjectGroupResource,
                resourceAreaHeaderContent: {
                    html: `
                    <button class="btn btn-sm btn-ghost" onclick="setting_project_gantt_modal.showModal()">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                            <path fill-rule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
                        </svg>                  
                        ตั้งค่าการแสดงผล
                    </button>
                `},
                resourceLabelContent: function (info) {
                    const sliceDate = (start, end) => {
                        if (!start || !end) return ''
                        const thaiDate = (date) => {
                            const arrDate = new Date(date).toLocaleDateString('th').split("/")
                            return `${arrDate[0]}/${arrDate[1]}`
                        }
                        return ` 📅 ${thaiDate(start)} ถึง ${thaiDate(end)}`
                    }

                    const { start, end } = info.resource._resource.extendedProps
                    return { html: `${info.resource.title} <small class="text-[#a52241]">${sliceDate(start, end)}</small>` }
                },
                displayEventTime: false,
                events: this.filteredProjectGroupEvents,
                eventColor: "#a52241",
                eventBorderColor: '#fff',
            });

            calendar.setOption("locale", "th");
            calendar.render();
            calendar.prev();
            setTimeout(() => {
                calendar.next();
            }, 200);

            const spans = document.querySelectorAll('span.fc-datagrid-expander-placeholder');
            spans.forEach(span => {
                span.classList.add('hidden');
            });
        },
        addSettingProjectGroup() {
            this.projectGroups.push({
                group_name: '',
                field_start: '',
                field_end: ''
            })
        },
        saveSettingProjectGroup() {
            const headers = {
                Authorization: `Bearer ${this.user.airtable_token}`,
                "Content-Type": "application/json",
            };
            try {
                axios.patch(`https://api.airtable.com/v0/appjfqpEHmnEsozi9/tbl64GrdfhsMbqiJ0/${this.tabActive.record_id}`,
                    {
                        fields: { project_groups: JSON.stringify(this.projectGroups) },
                    },
                    { headers }
                ).then(async (valUpdate) => {
                    this.getGantt();
                    this.closeModal('setting_project_gantt_modal')

                    const { id, fields } = valUpdate.data
                    this.tabActive = fields
                    this.tabActive.record_id = id
                    this.showGantt(this.tabActive)
                    this.renderProjectCalendar()
                })
            } catch (err) {
                this.toast.fire({
                    icon: "error",
                    title: "เกิดปัญหาบางอย่างขึ้นที่ saveSettingProjectGroup()"
                });
                console.error(err);
            }
        },
        saveFilter() {
            if (this.filters.some(f => f.field_name == null || f.field_name == '')) {
                return this.toast.fire({
                    icon: "warning",
                    title: "อย่างน้อยต้องกรอกชื่อฟิลด์ก่อนบันทึก"
                });
            }

            this.filters.forEach(f => {
                if (f.options) {
                    delete f.options
                }
            })

            const headers = {
                Authorization: `Bearer ${this.user.airtable_token}`,
                "Content-Type": "application/json",
            };
            try {
                axios.patch(`https://api.airtable.com/v0/appjfqpEHmnEsozi9/tbl64GrdfhsMbqiJ0/${this.tabActive.record_id}`,
                    {
                        fields: { conditions: JSON.stringify(this.filters) },
                    },
                    { headers }
                ).then((valUpdate) => {
                    this.getGantt();
                    this.closeModal('filter_modal')

                    const { id, fields } = valUpdate.data
                    this.tabActive = fields
                    this.tabActive.record_id = id
                    this.showGantt(this.tabActive)
                })
            } catch (err) {
                this.toast.fire({
                    icon: "error",
                    title: "เกิดปัญหาบางอย่างขึ้นที่ saveFilter()"
                });
                console.error(err);
            }
        },
        updateRecords() {
            const start = this.event.start ? this.event.start.slice(0, 10) : ''
            const end = this.event.end ? this.event.end.slice(0, 10) : ''
            const headers = {
                Authorization: `Bearer ${this.user.airtable_token}`,
                "Content-Type": "application/json",
            };
            const onlyStartUpdate = !this.tabActive.field_end ? { [this.tabActive.field_start]: start } : null

            try {
                axios.patch(
                    `https://api.airtable.com/v0/${this.tabActive.base_id}/${this.tabActive.table_id}/${this.event.id}`,
                    {
                        fields: onlyStartUpdate ? onlyStartUpdate : {
                            [this.tabActive.field_start]: start,
                            [this.tabActive.field_end]: end,
                        },
                    },
                    { headers }
                ).then(() => {
                    this.showGantt(this.tabActive)
                }).catch(err => {
                    this.toast.fire({
                        icon: "error",
                        title: "เกิดปัญหาบางอย่างขึ้นที่ updateRecords()"
                    });
                    console.error(err);
                })
            } catch (err) {
                this.toast.fire({
                    icon: "error",
                    title: "เกิดปัญหาบางอย่างขึ้นที่ updateRecords()"
                });
                console.error(err);
            }
        },
        windowResize() {
            const element = document.getElementById("calendar");
            const windowHeight = window.innerHeight;
            const size = windowHeight - 40 + "px";
            element.style.height = size;

            return size;
        },
        projectModalsize() {
            const element = document.getElementById("project_calendar");
            const windowHeight = window.innerHeight;
            const size = windowHeight - 120 + "px";
            element.style.height = size;

            return size;
        },
        addFilter() {
            if (this.filters.length == 0) return this.filters.push({ field_name: 'เลือกชื่อฟิลด์', operator: '=', value: '' })
            this.filters.push({ field_name: 'เลือกชื่อฟิลด์', operator: '=', value: '', more: 'AND' })
        },
        resetGroupEvent() {
            this.showGantt(this.tabActive)
        },
        initOptionValue(filters) {
            filters.forEach((field) => {
                const findSingleSelect = this.tabActive.fieldType?.filter(ft => {
                    const isSingleSelect = ft.name.includes(field.field_name) && ft.type.includes('singleSelect')
                    if (isSingleSelect) {
                        return ft
                    }
                }).map(el => el.options?.choices)

                field.options = findSingleSelect ? findSingleSelect[0] : null
            })
        }
    },
    watch: {
        filters(newVal) {
            if (newVal) {
                this.initOptionValue(newVal)
            }
        }
    },
    computed: {
        filteredSearchFieldValue() {
            const { label, value } = this.searchFieldValue
            const filterValue = this.filters.filter(f => f.field_name.includes(label))
            const result = filterValue[0]?.options?.filter(option => option.name.includes(value))
            return result
        },
        filteredSearchField() {
            return this.fieldOptions.filter(f => {
                return f.includes(this.searchField)
            })
        },
        filteredData() {
            let conditions
            if (this.tabActive?.conditions && this.tabActive.conditions !== "\n") {
                conditions = JSON.parse(this.tabActive.conditions.replace(/\\/g, ''))
                this.filters = conditions
            } else {
                this.filters = []
            }

            let projectGroups
            if (this.tabActive?.project_groups && this.tabActive.project_groups !== "\n") {
                projectGroups = JSON.parse(this.tabActive.project_groups.replace(/\\/g, ''))
                this.projectGroups = projectGroups
            } else {
                this.projectGroups = []
            }

            // function onConditions(more, field_name, operator, value) {
            //     if (more === "AND") {
            //         // switch (operator) {
            //         //     case '=':
            //         //         return field_name == value;
            //         //     case '!=':
            //         //         return field_name != value;
            //         //     default:
            //         //         return false;
            //         // }
            //     } else if (more === "OR") {
            //         if (operator == '=') return field_name == value;
            //         else return field_name != value;
            //     }
            // }
            function onConditions(field_name, operator, value) {
                if (operator == '=') return field_name == value;
                else return field_name != value;
            }

            function filterData(datas, conditions) {
                if (!conditions || conditions.length === 0) return datas;

                return datas.filter(d => {
                    if (!conditions) return d;
                    // const meetsAnyCondition = conditions.some(condition => onConditions(condition.more, d.fields[condition.field_name], condition.operator, condition.value))
                    // const meetsAllConditions = conditions.every(condition => onConditions(condition.more, d.fields[condition.field_name], condition.operator, condition.value))
                    const meetsAnyCondition = conditions.some(condition => onConditions(d.fields[condition.field_name], condition.operator, condition.value))
                    const meetsAllConditions = conditions.every(condition => onConditions(d.fields[condition.field_name], condition.operator, condition.value))
                    const any = conditions.some(condition => condition.more == "OR")
                    const all = conditions.some(condition => condition.more == "AND")
                    if (conditions.length == 1) {
                        if (conditions[0].operator == '=') {
                            return d.fields[conditions[0].field_name] === conditions[0].value
                        } else {
                            return d && d.fields[conditions[0].field_name] !== conditions[0].value
                        }
                    };

                    return (any && meetsAnyCondition) || (all && meetsAllConditions);
                })
            }

            const filteredData = filterData(this.data, conditions);
            return filteredData
        },
        filteredProjectGroupResource() {
            const filteredData = this.filteredData.filter(data => data.title == this.viewProject.name).map(d => {
                return this.projectGroups.map(g => {
                    return {
                        id: d.id,
                        title: d.title
                    }
                })
            })
            return filteredData[0]
        },
        filteredProjectGroupEvents() {
            const filteredData = this.filteredData.filter(data => data.title == this.viewProject.name).map(d => {
                return this.projectGroups.map(g => {
                    return {
                        resourceId: d.id,
                        title: g.group_name,
                        start: d.fields[g.field_start] ? `${d.fields[g.field_start]} 09:00:00` : '',
                        end: d.fields[g.field_end] ? `${d.fields[g.field_end]} 17:00:00` : '',
                        textColor: g.text_color,
                        backgroundColor: g.bg_color
                    }
                })
            })
            return filteredData[0]
        },
        filteredAllTeamResorce() {
            const filteredData = this.filteredData.map(data => {
                return {
                    id: data.id,
                    title: data.title
                }
            })
            return filteredData
        },
        filteredAllTeamEvents() {
            const filteredData = this.filteredData.map(d => {
                return this.projectGroups.map(g => {
                    return {
                        resourceId: d.id,
                        title: g.group_name,
                        start: d.fields[g.field_start] ? `${d.fields[g.field_start]} 09:00:00` : '',
                        end: d.fields[g.field_end] ? `${d.fields[g.field_end]} 17:00:00` : '',
                        textColor: g.text_color,
                        backgroundColor: g.bg_color
                    }
                })
            })

            return filteredData.reduce((acc, curr) => {
                return acc.concat(curr);
            }, [])
        },
    },
    async mounted() {
        await this.checkAuth();
        this.renderCalendar();
        window.addEventListener("resize", () => this.windowResize() && this.projectModalsize());
        window.addEventListener("focus", async () => {
            await this.getGantt();
            setTimeout(() => {
                this.showGantt(this.tabActive)
            }, 1000);
        });
    },
}).mount('#app')