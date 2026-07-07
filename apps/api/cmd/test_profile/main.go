package main

import (
	"context"
	"fmt"
	"github.com/synapse/api/internal/config"
	"github.com/synapse/api/internal/database"
	"github.com/synapse/api/internal/users"
	"log"
)

func main() {
	cfg, _ := config.LoadConfig()
	db, _ := database.Connect(cfg)
	repo := users.NewPGRepository(db.PG)
	u, err := repo.GetByID(context.Background(), 2070190580956139520) // using ID from db query
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("User ID: %d\n", u.ID)
	if u.AvatarKey != nil {
		fmt.Printf("Avatar: %s\n", *u.AvatarKey)
	} else {
		fmt.Println("Avatar: <nil>")
	}
	if u.BannerKey != nil {
		fmt.Printf("Banner: %s\n", *u.BannerKey)
	} else {
		fmt.Println("Banner: <nil>")
	}
}
