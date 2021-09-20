package types

import (
	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
)

type Mail struct {
	Id           int64       `json:"id"`
	FromList     string      `json:"fromList"`
	ToList       string      `json:"toList"`
	CcList       string      `json:"ccList"`
	BccList      string      `json:"bccList"`
	Subject      string      `json:"subject"`
	Body         string      `json:"body"`
	Date         int64       `json:"date"`
	AttemptCount int64       `json:"attemptCount"`
	AttemptDate  int64       `json:"attemptDate"`
	Files        int64       `json:"files"`     // number of attachments
	FilesSize    int64       `json:"filesSize"` // combined size in KB of all attachments
	Outgoing     bool        `json:"outgoing"`
	AccountId    pgtype.Int4 `json:"accountId"`   // mail account to send with / got mail from
	RecordId     pgtype.Int8 `json:"recordId"`    // record to update/get attachment of/from
	AttributeId  pgtype.UUID `json:"attributeId"` // file attribute to update/get attachment of/from
}
type MailAccount struct {
	Id       int32  `json:"id"`
	Name     string `json:"name"`
	Mode     string `json:"mode"`
	Username string `json:"username"`
	Password string `json:"password"`
	StartTls bool   `json:"startTls"`
	SendAs   string `json:"sendAs"`
	HostName string `json:"hostName"`
	HostPort int64  `json:"hostPort"`
}
type MailFile struct {
	Id   uuid.UUID `json:"id"`
	File []byte    `json:"file"`
	Name string    `json:"name"`
	Size int64     `json:"size"`
}