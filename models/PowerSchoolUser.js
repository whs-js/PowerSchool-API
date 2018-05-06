const PowerSchoolEvent = require("./PowerSchoolEvent");
const PowerSchoolTerm = require("./PowerSchoolTerm");
const PowerSchoolPeriod = require("./PowerSchoolPeriod");
const PowerSchoolReportingTerm = require("./PowerSchoolReportingTerm");
const PowerSchoolCourse = require("./PowerSchoolCourse");
const PowerSchoolStudent = require("./PowerSchoolStudent");
const PowerSchoolStudentInfo = require("./PowerSchoolStudentInfo");
const PowerSchoolSchool = require("./PowerSchoolSchool");
const PowerSchoolTeacher = require("./PowerSchoolTeacher");
const PowerSchoolAssignment = require("./PowerSchoolAssignment");
const PowerSchoolAssignmentScore = require("./PowerSchoolAssignmentScore");
const PowerSchoolAssignmentCategory = require("./PowerSchoolAssignmentCategory");
const PowerSchoolAttendanceRecord = require("./PowerSchoolAttendanceRecord");
const PowerSchoolAttendanceCode = require("./PowerSchoolAttendanceCode");
const PowerSchoolFinalGrade = require("./PowerSchoolFinalGrade");

/** 
 * A PowerSchool API user, which holds information about the user and methods to interact with them.
 * @hideconstructor
*/
class PowerSchoolUser {
    constructor(session, api) {
        this.session = session;
        if(this.session.serverCurrentTime) {
            // For some reason it provides it in a different format than it provides (wants ISO 8601)
            this.session.serverCurrentTime = new Date(this.session.serverCurrentTime).toISOString();
        }
        this.api = api;
        this._initUserVariables();
    }

    _initUserVariables() {
        this.userID = this.session.userId;
        this.userType = this.session.userType;
        // We need to fetch these separately
        this.studentData = new PowerSchoolStudentInfo();
    }

    /**
     * Get information about this student.
     * @return {Promise.<PowerSchoolStudentInfo, Error>} A promise that resolves with the user's student info, and rejects with an Error if one occurred.
     */
    getStudentInfo() {
        return new Promise((resolve, reject) => {
            var data = {
                userSessionVO: {
                    userId: this.userID,
                    serviceTicket: this.session.serviceTicket,
                    serverInfo: {
                        apiVersion: this.session.serverInfo.apiVersion
                    },
                    serverCurrentTime: this.session.serverCurrentTime,
                    userType: this.userType
                },
                studentIDs: this.session.studentIDs,
                qil: {
                    includes: "1"
                }
            }
            this.api.client.getStudentData(data, this.api.requestOptions, (err, result) => {
                if(!result || !result.return || !result.return.studentDataVOs) return reject(err);
                var data = result.return.studentDataVOs;

                // Deserialize any data we might need for special types
                var schools = (typeof data.schools === "array" ? data.schools : [data.schools]).map((data) => PowerSchoolSchool.fromData(data, this.api)); // for some reason sometimes is an array, sometimes is one school.
                var teachers = data.teachers.map((data) => PowerSchoolTeacher.fromData(data));
                var terms = data.terms.map((data) => PowerSchoolTerm.fromData(data, this.api));
                var reportingTerms = data.reportingTerms.map((data) => PowerSchoolReportingTerm.fromData(data, this.api));
                var assignments = data.assignments.map((data) => PowerSchoolAssignment.fromData(data, this.api));
                var assignmentScores = data.assignmentScores.map((data) => PowerSchoolAssignmentScore.fromData(data, this.api));
                var attendanceCodes = data.attendanceCodes.map((data) => PowerSchoolAttendanceCode.fromData(data, this.api));
                var periods = data.periods.map((data) => PowerSchoolPeriod.fromData(data, this.api));
                var courses = data.sections.map((data) => PowerSchoolCourse.fromData(data, this.api));
                var finalGrades = data.finalGrades.map((data) => PowerSchoolFinalGrade.fromData(data, this.api));

                // Add assignments to their categories
                var assignmentCategories = {};
                data.assignmentCategories.forEach((data) => assignmentCategories[data.id] = PowerSchoolAssignmentCategory.fromData(data, this.api));
                assignments.filter((a) => assignmentCategories[a.categoryID]).forEach((a) => assignmentCategories[a.categoryID].assignments.push(a));

                // Store information needed for other data mappings
                this.api.storeCacheInfo(teachers, "teachers");
                this.api.storeCacheInfo(schools, "schools", "schoolNumber");
                this.api.storeCacheInfo(periods, "periods");
                this.api.storeCacheInfo(courses, "courses");
                this.api.storeCacheInfo(finalGrades, "finalGrades", "courseID");
                this.api.storeCacheInfo(terms, "terms");
                this.api.storeCacheInfo(reportingTerms, "reportingTerms");
                this.api.storeCacheInfo(Object.values(assignmentCategories), "assignmentCategories");
                this.api.storeCacheInfo(assignments, "assignments");
                this.api.storeCacheInfo(assignmentScores, "assignmentScores", "assignmentID");
                this.api.storeCacheInfo(attendanceCodes, "attendanceCodes");

                // Store the rest of the data for use in the student model
                this.studentData.schools = schools;
                this.studentData.teachers = teachers;
                this.studentData.periods = periods;
                this.studentData.courses = courses;
                this.studentData.terms = terms;
                this.studentData.reportingTerms = reportingTerms;
                this.studentData.notInSessionDays = data.notInSessionDays.map((data) => PowerSchoolEvent.fromData(data, this.api));
                this.studentData.student = PowerSchoolStudent.fromData(data.student, this.api);
                this.studentData.yearID = data.yearId;
                this.studentData.assignmentCategories = Object.values(assignmentCategories);
                this.studentData.attendanceRecords = data.attendance.map((data) => PowerSchoolAttendanceRecord.fromData(data, this.api));
                this.studentData.attendanceCodes = attendanceCodes;
                this.studentData.finalGrades = finalGrades;

                resolve(this.studentData);
            });
        });
    }
}

module.exports = PowerSchoolUser;